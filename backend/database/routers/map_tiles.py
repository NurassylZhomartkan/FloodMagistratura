# backend/database/routers/map_tiles.py

import os
import sqlite3
import logging
import zlib
import math
import threading
import hashlib
from functools import lru_cache
from typing import Optional, List, Dict, Tuple
from dataclasses import dataclass

from fastapi import APIRouter, Depends, HTTPException, status, Response, Query
from fastapi.responses import Response as FastAPIResponse
from sqlalchemy.orm import Session

try:
    from PIL import Image
    import io
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

from database.database import get_db
from database.models.hec_ras import HecRasProject
from database.utils import detect_tile_schema, compute_bounds_from_tiles
from .auth import get_current_user

router = APIRouter(prefix="/api/map", tags=["map-tiles"])

# Кэш для схем тайлов (dataset_id -> schema)
_schema_cache = {}

# Кэш для прозрачного PNG 256x256
_transparent_tile_256x256 = None

# Кэш для проектов по share_hash (share_hash -> (id, filepath))
# Используется для избежания запросов к БД при каждом запросе тайла
_project_cache: Dict[str, Tuple[int, str]] = {}
_project_cache_lock = threading.Lock()


def create_transparent_tile_256x256() -> bytes:
    """
    Создаёт прозрачный PNG тайл размером 256x256 пикселей для отсутствующих тайлов.
    Возвращает байты PNG изображения.
    """
    global _transparent_tile_256x256
    if _transparent_tile_256x256 is not None:
        return _transparent_tile_256x256
    
    try:
        # Пытаемся использовать PIL/Pillow, если доступен
        from PIL import Image
        import io
        
        # Создаём полностью прозрачное изображение 256x256 (RGBA)
        img = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
        png_bytes = io.BytesIO()
        img.save(png_bytes, format='PNG')
        _transparent_tile_256x256 = png_bytes.getvalue()
        return _transparent_tile_256x256
    except ImportError:
        # Если PIL недоступен, создаём PNG вручную
        # PNG заголовок
        png_signature = b'\x89PNG\r\n\x1a\n'
        
        # IHDR chunk для 256x256 RGBA изображения
        width = 256
        height = 256
        ihdr_data = (
            width.to_bytes(4, 'big') +
            height.to_bytes(4, 'big') +
            b'\x08' +  # bit depth 8
            b'\x06' +  # color type 6 (RGBA)
            b'\x00' +  # compression method 0
            b'\x00' +  # filter method 0
            b'\x00'    # interlace method 0
        )
        ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data) & 0xffffffff
        ihdr_chunk = (
            len(ihdr_data).to_bytes(4, 'big') +
            b'IHDR' +
            ihdr_data +
            ihdr_crc.to_bytes(4, 'big')
        )
        
        # IDAT chunk - полностью прозрачные пиксели (RGBA: 0, 0, 0, 0)
        # Для RGBA 256x256: 256 * 256 * 4 = 262144 байт данных
        # Плюс фильтры: 256 строк * 1 байт фильтра = 256 байт
        # Итого: 262400 байт несжатых данных
        uncompressed_data = b'\x00' * (256 * 256 * 4 + 256)  # фильтр 0 (none) для каждой строки, все пиксели прозрачные
        compressed_data = zlib.compress(uncompressed_data, level=9)
        idat_crc = zlib.crc32(b'IDAT' + compressed_data) & 0xffffffff
        idat_chunk = (
            len(compressed_data).to_bytes(4, 'big') +
            b'IDAT' +
            compressed_data +
            idat_crc.to_bytes(4, 'big')
        )
        
        # IEND chunk
        iend_crc = zlib.crc32(b'IEND') & 0xffffffff
        iend_chunk = (
            b'\x00\x00\x00\x00' +
            b'IEND' +
            iend_crc.to_bytes(4, 'big')
        )
        
        # Собираем PNG
        _transparent_tile_256x256 = png_signature + ihdr_chunk + idat_chunk + iend_chunk
        return _transparent_tile_256x256


def get_project_by_id(db: Session, project_id: int, user_id: int) -> Optional[HecRasProject]:
    """Получает проект по ID с проверкой владельца."""
    project = (
        db.query(HecRasProject)
        .filter(HecRasProject.id == project_id, HecRasProject.owner_id == user_id)
        .first()
    )
    return project


def get_project_by_share_hash_cached(share_hash: str) -> Optional[Tuple[int, str]]:
    """Получает (project_id, filepath) по share_hash из кэша или None.
    
    Возвращает None, если проект не найден в кэше.
    Используется для избежания запросов к БД при каждом запросе тайла.
    """
    with _project_cache_lock:
        return _project_cache.get(share_hash)


def clear_project_cache(share_hash: Optional[str] = None):
    """Очищает кэш проектов.
    
    Args:
        share_hash: Если указан, очищает только этот проект. Если None, очищает весь кэш.
    """
    with _project_cache_lock:
        if share_hash:
            _project_cache.pop(share_hash, None)
            logging.debug(f"Cleared cache for share_hash: {share_hash}")
        else:
            _project_cache.clear()
            logging.debug("Cleared all project cache")


def get_project_by_share_hash(db: Session, share_hash: str) -> Optional[HecRasProject]:
    """Получает проект по share_hash (публичный доступ, без проверки владельца).
    
    Использует кэш для избежания запросов к БД при каждом запросе тайла.
    """
    # Проверяем кэш
    cached = get_project_by_share_hash_cached(share_hash)
    if cached:
        project_id, filepath = cached
        # Создаем простой объект с нужными атрибутами (без обращения к БД)
        project = type('Project', (), {'id': project_id, 'filepath': filepath, 'share_hash': share_hash})()
        logging.debug(f"Project cache hit for share_hash: {share_hash}")
        return project
    
    # Если нет в кэше, запрашиваем из БД
    try:
        project = (
            db.query(HecRasProject)
            .filter(HecRasProject.share_hash == share_hash)
            .first()
        )
        
        if project:
            # Сохраняем в кэш
            with _project_cache_lock:
                _project_cache[share_hash] = (project.id, project.filepath)
                logging.debug(f"Project cached for share_hash: {share_hash}")
        
        return project
    except Exception as e:
        logging.error(f"Error fetching project by share_hash {share_hash}: {type(e).__name__}: {str(e)}")
        raise


def get_tile_schema_cached(db_path: str, dataset_id: int) -> dict:
    """Получает схему тайлов с кэшированием."""
    if dataset_id not in _schema_cache:
        try:
            schema = detect_tile_schema(db_path)
            _schema_cache[dataset_id] = schema
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(e)
            )
    return _schema_cache[dataset_id]


@router.get(
    "/tiles/shared/{share_hash}/{z}/{x}/{y}.png",
    summary="Публичный доступ к тайлам",
    description="Публичный доступ к тайлам изображения по share_hash (без авторизации). Возвращает PNG тайл для отображения на карте. Поддерживает опциональный параметр time для временных данных и tms для инверсии Y координаты."
)
async def get_shared_tile(
    share_hash: str,
    z: int,
    x: int,
    y: int,
    time: Optional[str] = Query(None),
    tms: bool = Query(False, description="Use TMS Y coordinate inversion"),
    db: Session = Depends(get_db),
):
    """
    Публичный доступ к тайлам по share_hash (без авторизации).
    """
    try:
        logging.debug(f"Requesting shared tile: share_hash={share_hash}, z={z}, x={x}, y={y}, time={time}")
        
        # Сначала проверяем кэш (без обращения к БД)
        cached = get_project_by_share_hash_cached(share_hash)
        if cached:
            project_id, filepath = cached
            # Создаем простой объект проекта из кэша
            project = type('Project', (), {'id': project_id, 'filepath': filepath})()
            logging.debug(f"Using cached project: id={project_id}, filepath={filepath}")
        else:
            # Если нет в кэше, запрашиваем из БД (только один раз)
            project = get_project_by_share_hash(db, share_hash)
            if not project:
                logging.warning(f"Project not found for share_hash: {share_hash}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Dataset not found"
                )
            logging.debug(f"Found project from DB: id={project.id}, filepath={project.filepath}")
        
        dataset_id = project.id
        # Используем ту же логику, что и в get_tile
        return await _get_tile_internal(project, dataset_id, z, x, y, time, tms)
    except HTTPException:
        raise
    except Exception as e:
        logging.exception(f"Error serving shared tile {share_hash}/{z}/{x}/{y}: {type(e).__name__}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error loading tile: {str(e)}"
        )


async def _get_tile_internal(
    project: HecRasProject,
    dataset_id: int,
    z: int,
    x: int,
    y: int,
    time: Optional[str],
    tms: bool,
):
    """Внутренняя функция для получения тайла (используется и для авторизованных, и для публичных запросов)."""
    try:
        logging.debug(f"_get_tile_internal: dataset_id={dataset_id}, z={z}, x={x}, y={y}, time={time}, filepath={project.filepath}")
        
        if not os.path.exists(project.filepath):
            logging.error(f"Database file not found: {project.filepath}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Database file not found"
            )
        
        # Получаем схему тайлов
        try:
            schema = get_tile_schema_cached(project.filepath, dataset_id)
            logging.debug(f"Schema detected: {schema}")
        except Exception as e:
            logging.error(f"Error detecting tile schema for {project.filepath}: {type(e).__name__}: {str(e)}")
            raise
        
        # Конвертируем Y для TMS если нужно
        y_query = y
        if tms:
            y_query = (1 << z) - 1 - y
        
        # Открываем базу данных
        try:
            conn = sqlite3.connect(f"file:{project.filepath}?mode=ro", uri=True)
            conn.row_factory = sqlite3.Row
        except Exception as e:
            logging.error(f"Error opening database {project.filepath}: {type(e).__name__}: {str(e)}")
            raise
        
        try:
            table = schema['tile_table']
            z_col = schema['z_col']
            x_col = schema['x_col']
            y_col = schema['y_col']
            data_col = schema['data_col']
            time_col = schema.get('time_col')
            
            # Формируем SQL запрос
            if time_col and time:
                # Запрос с временем
                query = (
                    f"SELECT {data_col} FROM {table} "
                    f"WHERE {time_col} = ? AND {z_col} = ? AND {x_col} = ? AND {y_col} = ?"
                )
                params = (time, z, x, y_query)
                logging.debug(f"Executing query with time: {query}, params={params}")
            else:
                if time_col and not time:
                    logging.warning(f"time parameter is required for this dataset (has time_col: {time_col})")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"time parameter is required for this dataset (has time_col: {time_col})"
                    )
                # Запрос без времени
                query = (
                    f"SELECT {data_col} FROM {table} "
                    f"WHERE {z_col} = ? AND {x_col} = ? AND {y_col} = ?"
                )
                params = (z, x, y_query)
                logging.debug(f"Executing query without time: {query}, params={params}")
            
            try:
                cursor = conn.execute(query, params)
                row = cursor.fetchone()
                
                # Если тайл не найден и используется время, логируем примеры значений времени из БД для отладки
                if (not row or not row[0]) and time_col and time:
                    logging.debug(f"Tile not found with time={time}, checking sample time values in database")
                    try:
                        debug_query = f"SELECT DISTINCT {time_col} FROM {table} LIMIT 5"
                        debug_cursor = conn.execute(debug_query)
                        sample_times = [row[0] for row in debug_cursor.fetchall()]
                        logging.debug(f"Sample time values in database: {sample_times}")
                    except Exception as debug_e:
                        logging.debug(f"Could not fetch sample times: {debug_e}")
            except sqlite3.Error as e:
                logging.error(f"SQL error executing query: {query}, params={params}, error: {type(e).__name__}: {str(e)}")
                raise
            
            if row and row[0]:
                try:
                    tile_data = bytes(row[0])
                    logging.debug(f"Tile found: size={len(tile_data)} bytes")
                    return Response(
                        content=tile_data,
                        media_type="image/png",
                        headers={
                            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",  # 1 день, 7 дней stale-while-revalidate
                            "Access-Control-Allow-Origin": "*",  # CORS для canvas getImageData
                            "Access-Control-Allow-Methods": "GET, OPTIONS",
                            "Access-Control-Allow-Headers": "*",
                            "ETag": f'"{hashlib.md5(tile_data).hexdigest()[:16]}"',  # ETag для валидации
                        }
                    )
                except Exception as e:
                    logging.error(f"Error converting tile data to bytes: {type(e).__name__}: {str(e)}")
                    raise
            else:
                # Возвращаем прозрачный тайл вместо 404
                logging.debug(f"Tile not found, returning transparent tile")
                transparent_tile = create_transparent_tile_256x256()
                return Response(
                    content=transparent_tile,
                    media_type="image/png",
                    headers={
                        "Cache-Control": "public, max-age=3600",  # Кэшируем прозрачные тайлы на 1 час
                        "Access-Control-Allow-Origin": "*",
                    }
                )
                
        finally:
            conn.close()
    except HTTPException:
        raise
    except Exception as e:
        logging.exception(f"Error in _get_tile_internal: {type(e).__name__}: {str(e)}")
        raise


@router.get(
    "/tiles/{dataset_id}/{z}/{x}/{y}.png",
    summary="Получить тайл изображения",
    description="Возвращает тайл изображения из базы данных HEC-RAS проекта. Формат XYZ tiles (z/x/y.png). Поддерживает опциональный параметр time для временных данных и tms для инверсии Y координаты. Если тайл не найден, возвращает прозрачный PNG."
)
async def get_tile(
    dataset_id: int,
    z: int,
    x: int,
    y: int,
    time: Optional[str] = Query(None),
    tms: bool = Query(False, description="Use TMS Y coordinate inversion"),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Возвращает тайл изображения из базы данных.
    
    Args:
        dataset_id: ID проекта (dataset)
        z: zoom level
        x: tile column
        y: tile row (XYZ format)
        time: опциональный параметр времени (если есть time_col в схеме)
        tms: использовать инверсию Y координаты для TMS формата
    """
    try:
        # Получаем проект
        project = get_project_by_id(db, dataset_id, user.id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found"
            )
        
        return await _get_tile_internal(project, dataset_id, z, x, y, time, tms)
            
    except HTTPException:
        raise
    except Exception as e:
        logging.exception(f"Error serving tile {dataset_id}/{z}/{x}/{y}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error loading tile: {str(e)}"
        )


@router.get(
    "/metadata/shared/{share_hash}",
    summary="Публичные метаданные проекта",
    description="Публичный доступ к метаданным проекта по share_hash (без авторизации). Возвращает метаданные для dataset: bounds, center, minzoom, maxzoom, has_time. Используется для настройки карты перед загрузкой тайлов."
)
async def get_shared_metadata(
    share_hash: str,
    db: Session = Depends(get_db),
):
    """
    Публичный доступ к метаданным по share_hash (без авторизации).
    """
    try:
        # Проверяем кэш сначала
        cached = get_project_by_share_hash_cached(share_hash)
        if cached:
            project_id, filepath = cached
            project = type('Project', (), {'id': project_id, 'filepath': filepath})()
        else:
            project = get_project_by_share_hash(db, share_hash)
            if not project:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Dataset not found"
                )
        return await _get_metadata_internal(project, project.id)
    except HTTPException:
        raise
    except Exception as e:
        logging.exception(f"Error getting shared metadata for share_hash {share_hash}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error loading metadata: {str(e)}"
        )


async def _get_metadata_internal(project: HecRasProject, dataset_id: int):
    """Внутренняя функция для получения метаданных."""
    if not os.path.exists(project.filepath):
        logging.error(f"Database file not found: {project.filepath} for project {dataset_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Database file not found: {project.filepath}"
        )
    
    # Получаем схему тайлов
    schema = get_tile_schema_cached(project.filepath, dataset_id)
    
    # Проверяем наличие MBTiles metadata таблицы
    conn = sqlite3.connect(f"file:{project.filepath}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    
    metadata_result = {
        'has_time': schema.get('time_col') is not None
    }
    
    try:
        # Проверяем наличие таблицы metadata (MBTiles формат)
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='metadata'"
        )
        if cursor.fetchone():
            # Читаем метаданные из таблицы metadata
            cursor = conn.execute("SELECT name, value FROM metadata")
            metadata_rows = cursor.fetchall()
            
            for row in metadata_rows:
                name = row['name']
                value = row['value']
                
                if name == 'bounds':
                    # Формат: "west, south, east, north"
                    try:
                        coords = [float(x.strip()) for x in value.split(',')]
                        if len(coords) == 4:
                            metadata_result['bounds'] = coords
                    except:
                        pass
                elif name == 'center':
                    # Формат: "lon, lat, zoom"
                    try:
                        coords = [float(x.strip()) for x in value.split(',')]
                        if len(coords) >= 2:
                            metadata_result['center'] = coords[:2]
                    except:
                        pass
                elif name == 'minzoom':
                    try:
                        metadata_result['minzoom'] = int(value)
                    except:
                        pass
                elif name == 'maxzoom':
                    try:
                        metadata_result['maxzoom'] = int(value)
                    except:
                        pass
        
        # Если не нашли в metadata таблице, вычисляем из тайлов
        if 'bounds' not in metadata_result:
            computed = compute_bounds_from_tiles(project.filepath, schema)
            metadata_result.update(computed)
        elif 'minzoom' not in metadata_result or 'maxzoom' not in metadata_result:
            computed = compute_bounds_from_tiles(project.filepath, schema)
            if 'minzoom' not in metadata_result:
                metadata_result['minzoom'] = computed.get('minzoom', 0)
            if 'maxzoom' not in metadata_result:
                metadata_result['maxzoom'] = computed.get('maxzoom', 18)
        if 'center' not in metadata_result and 'bounds' in metadata_result:
            bounds = metadata_result['bounds']
            metadata_result['center'] = [
                (bounds[0] + bounds[2]) / 2,
                (bounds[1] + bounds[3]) / 2
            ]
            
    finally:
        conn.close()
    
    return metadata_result


@router.get(
    "/metadata/{dataset_id}",
    summary="Получить метаданные проекта",
    description="Возвращает метаданные для dataset (bounds, center, minzoom, maxzoom, has_time). Метаданные используются для настройки карты: границы видимой области, центр по умолчанию, диапазон уровней масштабирования, наличие временных данных."
)
async def get_metadata(
    dataset_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Возвращает метаданные для dataset (bounds, center, minzoom, maxzoom, has_time).
    """
    try:
        logging.info(f"Getting metadata for dataset {dataset_id}, user_id: {user.id}")
        project = get_project_by_id(db, dataset_id, user.id)
        if not project:
            logging.warning(f"Project {dataset_id} not found for user {user.id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found"
            )
        
        logging.info(f"Found project {dataset_id}, filepath: {project.filepath}")
        if not os.path.exists(project.filepath):
            logging.error(f"Database file not found for project {dataset_id}: {project.filepath}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Database file not found: {project.filepath}"
            )
        
        return await _get_metadata_internal(project, dataset_id)
        
    except HTTPException:
        raise
    except Exception as e:
        logging.exception(f"Error getting metadata for dataset {dataset_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error loading metadata: {str(e)}"
        )


@router.get(
    "/times/shared/{share_hash}",
    summary="Публичный список времен",
    description="Публичный доступ к списку времен по share_hash (без авторизации). Возвращает массив доступных временных значений для проекта. Используется только для проектов с временной привязкой данных."
)
async def get_shared_times(
    share_hash: str,
    db: Session = Depends(get_db),
):
    """
    Публичный доступ к списку времен по share_hash (без авторизации).
    """
    try:
        # Проверяем кэш сначала
        cached = get_project_by_share_hash_cached(share_hash)
        if cached:
            project_id, filepath = cached
            project = type('Project', (), {'id': project_id, 'filepath': filepath})()
        else:
            project = get_project_by_share_hash(db, share_hash)
            if not project:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Dataset not found"
                )
        return await _get_times_internal(project, project.id)
    except HTTPException:
        raise
    except Exception as e:
        logging.exception(f"Error getting shared times for share_hash {share_hash}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error loading times: {str(e)}"
        )


async def _get_times_internal(project: HecRasProject, dataset_id: int):
    """Внутренняя функция для получения списка времен."""
    if not os.path.exists(project.filepath):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database file not found"
        )
    
    # Получаем схему тайлов
    schema = get_tile_schema_cached(project.filepath, dataset_id)
    
    time_col = schema.get('time_col')
    if not time_col:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This dataset does not have a time column"
        )
    
    # Получаем уникальные значения времени
    conn = sqlite3.connect(f"file:{project.filepath}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    
    try:
        table = schema['tile_table']
        query = f"SELECT DISTINCT {time_col} FROM {table} ORDER BY {time_col}"
        cursor = conn.execute(query)
        times = [row[0] for row in cursor.fetchall()]
        
        return {"times": times}
        
    finally:
        conn.close()


@router.get(
    "/times/{dataset_id}",
    summary="Получить список времен",
    description="Возвращает список доступных времен для dataset (только если есть time_col). Используется для отображения временной шкалы и переключения между временными шагами на карте."
)
async def get_times(
    dataset_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Возвращает список доступных времен для dataset (только если есть time_col).
    """
    try:
        project = get_project_by_id(db, dataset_id, user.id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found"
            )
        
        return await _get_times_internal(project, dataset_id)
            
    except HTTPException:
        raise
    except Exception as e:
        logging.exception(f"Error getting times for dataset {dataset_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error loading times: {str(e)}"
        )


def lonlat_to_tile(lon: float, lat: float, z: int) -> Tuple[int, int]:
    """Конвертирует долготу и широту в тайловые координаты (XYZ Web Mercator)."""
    n = 2.0 ** z
    x = int((lon + 180.0) / 360.0 * n)
    lat_rad = math.radians(lat)
    y = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return x, y


def tile_to_lonlat(x: int, y: int, z: int) -> Tuple[float, float]:
    """Конвертирует тайловые координаты в долготу и широту."""
    n = 2.0 ** z
    lon = x / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * y / n)))
    lat = math.degrees(lat_rad)
    return lon, lat


def calculate_tile_area_km2(x: int, y: int, z: int) -> float:
    """Вычисляет площадь тайла в квадратных километрах."""
    # Получаем координаты углов тайла
    lon1, lat1 = tile_to_lonlat(x, y, z)
    lon2, lat2 = tile_to_lonlat(x + 1, y + 1, z)
    
    # Приблизительный расчет площади (для небольших областей достаточно точно)
    # Используем формулу для площади сферического прямоугольника
    lat_avg = (lat1 + lat2) / 2.0
    dlat = abs(lat2 - lat1)
    dlon = abs(lon2 - lon1)
    
    # Конвертируем градусы в километры
    # 1 градус широты ≈ 111 км
    # 1 градус долготы ≈ 111 км * cos(широта)
    lat_km = dlat * 111.0
    lon_km = dlon * 111.0 * math.cos(math.radians(lat_avg))
    
    area_km2 = lat_km * lon_km
    return area_km2 if area_km2 > 0 else 0.0


def calculate_flooded_area_from_tile(tile_data: bytes) -> float:
    """Вычисляет долю затопленных пикселей в тайле на основе анализа пикселей (0.0 - 1.0).
    
    Анализирует каждый пиксель тайла и определяет, является ли он затопленным.
    
    Затопленным считается пиксель, который:
    1. Не полностью прозрачный (alpha > порога)
    2. Имеет цвет, указывающий на воду/затопление:
       - Синий оттенок (вода)
       - Зеленовато-синий (cyan) - мелкая вода
       - Желтый/оранжевый/красный - глубокое затопление
       - Не белый/светло-серый фон карты
    
    Returns:
        float: Доля затопленных пикселей от общего количества пикселей в тайле (0.0 - 1.0)
    """
    if not HAS_PIL:
        # Если PIL недоступен, возвращаем 0 (безопаснее, чем приближение)
        return 0.0
    
    try:
        img = Image.open(io.BytesIO(tile_data))
        # Конвертируем в RGBA если нужно
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        pixels = img.load()
        width, height = img.size
        
        # Считаем пиксели с водой/затоплением
        flooded_pixels = 0
        total_pixels = width * height
        
        for y in range(height):
            for x in range(width):
                r, g, b, a = pixels[x, y]
                
                # Упрощенная логика: пиксель считается затопленным, если:
                # 1. Он не полностью прозрачный (alpha > порога)
                # 2. Он не является белым/светло-серым фоном карты
                # Порог прозрачности: alpha > 5 (чтобы учесть все видимые пиксели, включая полупрозрачные)
                if a > 5:
                    # Проверяем, что это не белый/светло-серый фон карты
                    # Белый фон обычно имеет r, g, b все близко к 255
                    brightness = (r + g + b) / 3
                    # Более строгая проверка на белый фон - все каналы должны быть очень светлыми
                    is_white_background = (r > 250 and g > 250 and b > 250) or brightness > 252
                    
                    # Если пиксель не белый фон и достаточно непрозрачный, считаем его затопленным
                    if not is_white_background:
                        flooded_pixels += 1
        
        # Доля затопленных пикселей
        flooded_ratio = flooded_pixels / total_pixels if total_pixels > 0 else 0
        
        # Логируем для отладки (всегда, чтобы видеть что происходит)
        if flooded_ratio > 0:
            logging.info(f"Tile analysis: {flooded_pixels}/{total_pixels} pixels flooded ({flooded_ratio*100:.2f}%)")
        elif total_pixels > 0:
            # Логируем первые несколько тайлов без затопления для отладки
            logging.debug(f"Tile analysis: {flooded_pixels}/{total_pixels} pixels flooded ({flooded_ratio*100:.2f}%) - no flood detected")
        
        return flooded_ratio  # Возвращаем долю, площадь будет вычислена с учетом zoom
    except Exception as e:
        logging.error(f"Error calculating flooded area from tile: {e}")
        return 0.0


@router.get(
    "/flood-area/{dataset_id}",
    summary="Вычислить площадь затопления",
    description="Вычисляет площадь затопления на основе пикселей тайлов, которые в данный момент видны на карте. Анализирует каждый видимый тайл для определения затопленных областей и рассчитывает общую площадь. Возвращает площадь в квадратных километрах, количество обработанных тайлов и параметры запроса."
)
async def get_flood_area(
    dataset_id: int,
    bounds: str = Query(..., description="Bounds as 'west,south,east,north'"),
    zoom: int = Query(..., description="Zoom level"),
    time: Optional[str] = Query(None, description="Time value (optional)"),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Вычисляет площадь затопления на основе пикселей тайлов, которые в данный момент видны на карте.
    
    Алгоритм:
    1. Определяет видимые тайлы на основе границ карты и уровня масштабирования
    2. Для каждого видимого тайла анализирует пиксели для определения затопленных областей
    3. Рассчитывает площадь затопления для каждого тайла на основе доли затопленных пикселей
    4. Суммирует площади всех видимых тайлов
    
    Args:
        dataset_id: ID проекта
        bounds: Границы видимой области карты в формате 'west,south,east,north'
        zoom: Уровень масштабирования карты
        time: Опциональное значение времени (если данные имеют временную привязку)
    
    Returns:
        dict: Словарь с площадью затопления (area_km2), количеством обработанных тайлов и другой информацией
    """
    try:
        # Получаем проект
        project = get_project_by_id(db, dataset_id, user.id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found"
            )
        
        if not os.path.exists(project.filepath):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Database file not found"
            )
        
        # Парсим границы
        try:
            coords = [float(x.strip()) for x in bounds.split(',')]
            if len(coords) != 4:
                raise ValueError("Bounds must have 4 values")
            west, south, east, north = coords
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid bounds format: {e}"
            )
        
        # Получаем схему тайлов
        schema = get_tile_schema_cached(project.filepath, dataset_id)
        
        # Вычисляем диапазон тайлов для видимой области на карте
        # Используем границы карты для определения видимых тайлов
        x_min, y_min = lonlat_to_tile(west, north, zoom)  # Северо-западный угол
        x_max, y_max = lonlat_to_tile(east, south, zoom)  # Юго-восточный угол
        
        # Убеждаемся, что x_min < x_max и y_min < y_max
        if x_min > x_max:
            x_min, x_max = x_max, x_min
        if y_min > y_max:
            y_min, y_max = y_max, y_min
        
        # Добавляем небольшой буфер для тайлов на краях (чтобы учесть частично видимые тайлы)
        # Это гарантирует, что мы учитываем все тайлы, которые хотя бы частично видны на экране
        x_min = max(0, x_min - 1)
        y_min = max(0, y_min - 1)
        x_max = x_max + 1
        y_max = y_max + 1
        
        logging.info(f"Calculating flood area for visible tiles: zoom={zoom}, x_range=[{x_min}, {x_max}], y_range=[{y_min}, {y_max}], time={time}")
        
        # Открываем базу данных
        conn = sqlite3.connect(f"file:{project.filepath}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        
        try:
            table = schema['tile_table']
            z_col = schema['z_col']
            x_col = schema['x_col']
            y_col = schema['y_col']
            data_col = schema['data_col']
            time_col = schema.get('time_col')
            
            total_flooded_area_km2 = 0.0
            tiles_processed = 0
            tiles_found = 0
            tiles_not_found = 0
            
            logging.info(f"Starting flood area calculation: time={time}, zoom={zoom}, tile_range x=[{x_min}, {x_max}], y=[{y_min}, {y_max}]")
            
            # Обрабатываем каждый тайл в видимой области
            for x in range(x_min, x_max + 1):
                for y in range(y_min, y_max + 1):
                    # Формируем SQL запрос
                    if time_col and time:
                        query = (
                            f"SELECT {data_col} FROM {table} "
                            f"WHERE {time_col} = ? AND {z_col} = ? AND {x_col} = ? AND {y_col} = ?"
                        )
                        params = (time, zoom, x, y)
                    else:
                        if time_col and not time:
                            tiles_not_found += 1
                            continue  # Пропускаем если требуется время, но не указано
                        query = (
                            f"SELECT {data_col} FROM {table} "
                            f"WHERE {z_col} = ? AND {x_col} = ? AND {y_col} = ?"
                        )
                        params = (zoom, x, y)
                    
                    cursor = conn.execute(query, params)
                    row = cursor.fetchone()
                    
                    if row and row[0]:
                        tiles_found += 1
                        tile_data = bytes(row[0])
                        
                        # Анализируем пиксели тайла для определения площади затопления
                        # Функция анализирует каждый пиксель тайла и определяет, является ли он затопленным
                        flooded_ratio = calculate_flooded_area_from_tile(tile_data)
                        
                        # Площадь тайла на данном zoom level (в квадратных километрах)
                        tile_area_km2 = calculate_tile_area_km2(x, y, zoom)
                        
                        # Площадь затопления в этом тайле = доля затопленных пикселей * площадь тайла
                        flooded_area_km2 = flooded_ratio * tile_area_km2
                        total_flooded_area_km2 += flooded_area_km2
                        tiles_processed += 1
                        
                        # Логируем для отладки (только первые несколько тайлов или если есть затопление)
                        if tiles_processed <= 5 or flooded_ratio > 0:
                            logging.info(f"Tile {x},{y} at zoom {zoom}, time {time}: "
                                        f"flooded_ratio={flooded_ratio:.4f}, "
                                        f"tile_area={tile_area_km2:.4f} km², "
                                        f"flooded_area={flooded_area_km2:.4f} km²")
                    else:
                        tiles_not_found += 1
                        # Логируем первые несколько отсутствующих тайлов для отладки
                        if tiles_not_found <= 3:
                            logging.debug(f"Tile {x},{y} at zoom {zoom}, time {time}: NOT FOUND in database")
            
            logging.info(f"Flood area calculation summary: tiles_found={tiles_found}, tiles_not_found={tiles_not_found}, tiles_processed={tiles_processed}, total_area={total_flooded_area_km2:.4f} km²")
            
            logging.info(f"Flood area calculation: time={time}, tiles_processed={tiles_processed}, total_area={total_flooded_area_km2:.4f} km²")
            
            return {
                "area_km2": round(total_flooded_area_km2, 4),
                "tiles_processed": tiles_processed,
                "bounds": [west, south, east, north],
                "zoom": zoom,
                "time": time
            }
            
        finally:
            conn.close()
            
    except HTTPException:
        raise
    except Exception as e:
        logging.exception(f"Error calculating flood area for dataset {dataset_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating flood area: {str(e)}"
        )


@router.get(
    "/flood-area-time-series/{dataset_id}",
    summary="Временной ряд площади затопления",
    description="Возвращает серию данных о площади затопления во времени для видимых границ. Вычисляет площадь затопления для каждого временного шага проекта. Используется для построения графиков изменения площади затопления во времени."
)
async def get_flood_area_time_series(
    dataset_id: int,
    bounds: str = Query(..., description="Bounds as 'west,south,east,north'"),
    zoom: int = Query(..., description="Zoom level"),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Возвращает серию данных о площади затопления во времени для видимых границ.
    """
    try:
        # Получаем проект
        project = get_project_by_id(db, dataset_id, user.id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found"
            )
        
        if not os.path.exists(project.filepath):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Database file not found"
            )
        
        # Получаем схему тайлов
        schema = get_tile_schema_cached(project.filepath, dataset_id)
        
        time_col = schema.get('time_col')
        if not time_col:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This dataset does not have a time column"
            )
        
        # Получаем список времен
        conn = sqlite3.connect(f"file:{project.filepath}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        
        try:
            table = schema['tile_table']
            query = f"SELECT DISTINCT {time_col} FROM {table} ORDER BY {time_col}"
            cursor = conn.execute(query)
            times = [row[0] for row in cursor.fetchall()]
            
            if not times:
                return {"times": [], "areas": []}
            
            # Парсим границы
            try:
                coords = [float(x.strip()) for x in bounds.split(',')]
                if len(coords) != 4:
                    raise ValueError("Bounds must have 4 values")
                west, south, east, north = coords
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid bounds format: {e}"
                )
            
            # Вычисляем диапазон тайлов
            x_min, y_min = lonlat_to_tile(west, north, zoom)
            x_max, y_max = lonlat_to_tile(east, south, zoom)
            
            if x_min > x_max:
                x_min, x_max = x_max, x_min
            if y_min > y_max:
                y_min, y_max = y_max, y_min
            
            z_col = schema['z_col']
            x_col = schema['x_col']
            y_col = schema['y_col']
            data_col = schema['data_col']
            
            # Вычисляем площадь для каждого времени
            time_series = []
            for time_value in times:
                total_flooded_area_km2 = 0.0
                tiles_processed = 0
                
                for x in range(x_min, x_max + 1):
                    for y in range(y_min, y_max + 1):
                        query = (
                            f"SELECT {data_col} FROM {table} "
                            f"WHERE {time_col} = ? AND {z_col} = ? AND {x_col} = ? AND {y_col} = ?"
                        )
                        params = (time_value, zoom, x, y)
                        
                        cursor = conn.execute(query, params)
                        row = cursor.fetchone()
                        
                        if row and row[0]:
                            tile_data = bytes(row[0])
                            flooded_ratio = calculate_flooded_area_from_tile(tile_data)
                            tile_area_km2 = calculate_tile_area_km2(x, y, zoom)
                            flooded_area_km2 = flooded_ratio * tile_area_km2
                            total_flooded_area_km2 += flooded_area_km2
                            tiles_processed += 1
                
                time_series.append({
                    "time": time_value,
                    "area_km2": round(total_flooded_area_km2, 4)
                })
            
            return {
                "times": [item["time"] for item in time_series],
                "areas": [item["area_km2"] for item in time_series]
            }
            
        finally:
            conn.close()
            
    except HTTPException:
        raise
    except Exception as e:
        logging.exception(f"Error calculating flood area time series for dataset {dataset_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating flood area time series: {str(e)}"
        )

