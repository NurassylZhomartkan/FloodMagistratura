# backend/database/routers/flood.py

import os
import logging
import httpx
import uuid
import json
import secrets
from pathlib import Path
from typing import Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile, Form, Body
from fastapi.responses import Response
from sqlalchemy.orm import Session
import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling
import numpy as np
from PIL import Image
import io

from database.routers.auth import get_current_user
from database.models.user import User
from database.database import get_db
from database.crud import (
    create_flood_project as crud_create_flood_project,
    get_flood_project,
    get_flood_project_by_share_hash,
    update_flood_project_share
)
from database.file_paths import get_terrain_file_path
from database.dtm_filter_core import apply_dtm_filter_geotiff_bytes
from database.noise_filter_core import apply_bilateral_noise_filter_geotiff_bytes
from database.hydro_correction_core import apply_hydrologic_correction_geotiff_bytes
from database.fill_missing_core import fill_missing_values_geotiff_bytes

router = APIRouter(prefix="/api/flood", tags=["Flood"])

# API ключ OpenTopography (должен быть в переменных окружения)
OPENTOPOGRAPHY_API_KEY = os.getenv("OPENTOPOGRAPHY_API_KEY", "d9f790e75f9caf072870b69978a77a39")

# Google OAuth Client ID для Google Earth Engine (опционально)
GOOGLE_OAUTH_CLIENT_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "")

# Путь к JSON файлу сервисного аккаунта Google Earth Engine (рекомендуется для production)
GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT_JSON = os.getenv("GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT_JSON", "")

# Простое хранилище проектов и файлов в памяти (можно перенести в БД позже)
flood_projects: Dict[int, Dict] = {}
terrain_files: Dict[str, Dict] = {}
next_project_id = 1


# Кэш для тайлов: ключ = (filepath, z, x, y), значение = bytes
_tile_cache: Dict[tuple, bytes] = {}
# Максимальный размер кэша (в количестве тайлов)
MAX_TILE_CACHE_SIZE = 1000


@router.get(
    "/opentopography/globaldem",
    summary="Получить данные рельефа из OpenTopography",
    description="Проксирует запрос к OpenTopography API для получения данных рельефа (DEM). Возвращает бинарный файл GeoTIFF с данными высот для указанной области. Поддерживает различные типы DEM (COP30, COP90 и др.). Требует API ключ OpenTopography."
)
async def proxy_opentopography_globaldem(
    demtype: str = Query(..., description="Тип DEM (COP30, COP90 и т.д.)"),
    south: float = Query(..., description="Южная граница"),
    north: float = Query(..., description="Северная граница"),
    west: float = Query(..., description="Западная граница"),
    east: float = Query(..., description="Восточная граница"),
    outputFormat: str = Query("GTiff", description="Формат вывода"),
    user: User = Depends(get_current_user),
):
    """
    Проксирует запрос к OpenTopography API для получения данных рельефа.
    Возвращает бинарный файл GeoTIFF.
    """
    # Логируем успешную авторизацию
    logging.info(f"✅ OpenTopography API запрос от пользователя: {user.username} (ID: {user.id})")
    try:
        # Формируем URL для запроса к OpenTopography API
        params = {
            "demtype": demtype,
            "south": south,
            "north": north,
            "west": west,
            "east": east,
            "outputFormat": outputFormat,
            "API_Key": OPENTOPOGRAPHY_API_KEY,
        }
        
        opentopography_url = "https://portal.opentopography.org/API/globaldem"
        
        logging.info(f"Proxying request to OpenTopography API: {params}")
        
        # Выполняем запрос к OpenTopography API
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.get(opentopography_url, params=params)
            
            if not response.is_success:
                error_text = response.text
                logging.error(f"OpenTopography API error: {response.status_code} - {error_text}")
                
                # Если это ошибка лимита запросов, возвращаем более понятное сообщение
                if response.status_code == 401 and "rate limit" in error_text.lower():
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Превышен лимит запросов к OpenTopography API (50 запросов в 24 часа). Пожалуйста, попробуйте позже."
                    )
                
                # Для других ошибок возвращаем статус от OpenTopography API, но с понятным сообщением
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Ошибка запроса к OpenTopography API: {response.status_code} {response.reason_phrase}. {error_text[:200]}"
                )
            
            # Проверяем тип ответа
            content_type = response.headers.get("content-type", "")
            
            if "application/json" in content_type:
                # Если ответ JSON, это скорее всего ошибка
                error_data = response.json()
                logging.error(f"OpenTopography API returned JSON (error): {error_data}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=error_data.get("message") or error_data.get("error") or "Ошибка при получении данных из OpenTopography API"
                )
            
            # Проверяем, что файл не пустой
            if len(response.content) == 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Получен пустой файл от OpenTopography API"
                )
            
            logging.info(f"Successfully received file from OpenTopography API, size: {len(response.content)} bytes")
            
            # Возвращаем бинарный файл
            return Response(
                content=response.content,
                media_type=content_type or "application/octet-stream",
                headers={
                    "Content-Disposition": "attachment; filename=opentopography_terrain.tif"
                }
            )
            
    except httpx.TimeoutException:
        logging.error("Timeout while requesting OpenTopography API")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Превышено время ожидания ответа от OpenTopography API"
        )
    except httpx.RequestError as e:
        logging.error(f"Request error while proxying OpenTopography API: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Ошибка при обращении к OpenTopography API: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logging.exception(f"Unexpected error while proxying OpenTopography API: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )


@router.get(
    "/worldcover/download",
    summary="Загрузить данные WorldCover",
    description="Загружает данные WorldCover (Sentinel-2 based, разрешение 10 метров) для указанной области. Использует Google Earth Engine API для получения данных о покрытии земной поверхности. Возвращает бинарный файл GeoTIFF."
)
async def download_worldcover(
    south: float = Query(..., description="Южная граница"),
    north: float = Query(..., description="Северная граница"),
    west: float = Query(..., description="Западная граница"),
    east: float = Query(..., description="Восточная граница"),
    outputFormat: str = Query("GTiff", description="Формат вывода"),
    user: User = Depends(get_current_user),
):
    """
    Загружает данные WorldCover (Sentinel-2 based, 10 meter resolution) для указанной области.
    Возвращает бинарный файл GeoTIFF.
    
    Использует Google Earth Engine API для получения данных WorldCover.
    """
    logging.info(f"✅ WorldCover API запрос от пользователя: {user.username} (ID: {user.id})")
    
    try:
        # Валидация координат
        if west >= east or south >= north:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Некорректные координаты области"
            )
        
        # Пытаемся использовать Google Earth Engine API
        try:
            import ee
            
            # Инициализируем Google Earth Engine
            # Приоритет: сервисный аккаунт (JSON файл) > существующие credentials > ошибка
            try:
                # Сначала пробуем использовать сервисный аккаунт, если указан путь к JSON файлу
                if GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT_JSON:
                    json_path = Path(GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT_JSON)
                    if json_path.exists():
                        logging.info(f"Инициализация Google Earth Engine с сервисным аккаунтом: {json_path}")
                        credentials = ee.ServiceAccountCredentials(None, str(json_path))
                        ee.Initialize(credentials)
                    else:
                        logging.warning(f"Файл сервисного аккаунта не найден: {json_path}")
                        # Пробуем стандартную инициализацию
                        ee.Initialize()
                else:
                    # Пробуем стандартную инициализацию (использует существующие credentials)
                    ee.Initialize()
            except Exception as init_error:
                error_msg = str(init_error)
                logging.warning(f"Google Earth Engine не инициализирован: {init_error}")
                
                # Формируем понятное сообщение об ошибке
                if "authenticate" in error_msg.lower() or "authorize" in error_msg.lower():
                    detail_msg = (
                        "Требуется настройка Google Earth Engine. "
                        "Для production использования создайте сервисный аккаунт:\n"
                        "1. Перейдите в Google Cloud Console и создайте сервисный аккаунт\n"
                        "2. Скачайте JSON ключ и сохраните в безопасном месте\n"
                        "3. Зарегистрируйте сервисный аккаунт в Google Earth Engine\n"
                        "4. Добавьте в .env: GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT_JSON=путь/к/файлу.json\n\n"
                        "Для разработки выполните один раз: earthengine authenticate\n\n"
                        f"Техническая ошибка: {error_msg}"
                    )
                else:
                    detail_msg = f"Не удалось инициализировать Google Earth Engine: {error_msg}"
                
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=detail_msg
                )
            
            # Загружаем коллекцию WorldCover
            worldcover = ee.ImageCollection("ESA/WorldCover/v100").first()
            
            # Обрезаем по границам области
            region = ee.Geometry.Rectangle([west, south, east, north])
            worldcover_clipped = worldcover.clip(region)
            
            # Получаем URL для экспорта изображения
            # Используем getDownloadURL для получения данных напрямую
            try:
                # Конвертируем изображение в формат, подходящий для экспорта
                # Используем масштаб 10 метров (разрешение WorldCover)
                scale = 10
                
                # Получаем URL для скачивания
                url = worldcover_clipped.getDownloadURL({
                    'scale': scale,
                    'crs': 'EPSG:4326',
                    'region': region
                })
                
                # Загружаем данные через httpx
                async with httpx.AsyncClient(timeout=300.0) as client:
                    response = await client.get(url)
                    
                    if not response.is_success:
                        raise HTTPException(
                            status_code=status.HTTP_502_BAD_GATEWAY,
                            detail=f"Ошибка при получении данных из Google Earth Engine: {response.status_code}"
                        )
                    
                    # Возвращаем бинарный файл
                    return Response(
                        content=response.content,
                        media_type="application/x-geotiff",
                        headers={
                            "Content-Disposition": "attachment; filename=worldcover.tif"
                        }
                    )
                    
            except Exception as download_error:
                logging.error(f"Ошибка при загрузке данных из Google Earth Engine: {download_error}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Ошибка при загрузке данных WorldCover: {str(download_error)}"
                )
                
        except ImportError:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Библиотека earthengine-api не установлена. Установите её: pip install earthengine-api"
            )
        except HTTPException:
            raise
        except Exception as gee_error:
            logging.exception(f"Ошибка при работе с Google Earth Engine: {gee_error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при работе с Google Earth Engine: {str(gee_error)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logging.exception(f"Unexpected error while downloading WorldCover: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )


def get_terrain_bounds(file_path: str) -> Dict[str, float]:
    """Извлекает границы (bounds) из GeoTIFF файла."""
    try:
        with rasterio.open(file_path) as src:
            bounds = src.bounds
            return {
                'west': bounds.left,
                'south': bounds.bottom,
                'east': bounds.right,
                'north': bounds.top
            }
    except Exception as e:
        logging.error(f"Error reading terrain bounds from {file_path}: {e}")
        raise


def apply_dtm_filter(data: np.ndarray, sensitivity_multiplier: float = 1.0, num_iterations: int = 200) -> np.ndarray:
    """
    Применяет DTM фильтр для удаления растительности и зданий из данных высот.
    
    Args:
        data: Массив данных высот (может содержать NaN)
        sensitivity_multiplier: Множитель чувствительности фильтра (по умолчанию 1.0)
        num_iterations: Количество итераций фильтра (по умолчанию 200)
        
    Returns:
        Отфильтрованный массив данных
    """
    if data.size == 0:
        return data
    
    # Создаем копию данных для работы
    filtered_data = data.copy()
    
    # Определяем валидные пиксели
    valid_mask = np.isfinite(filtered_data)
    
    if not np.any(valid_mask):
        return filtered_data
    
    # Применяем простой алгоритм DTM фильтра
    # Используем скользящее окно для вычисления локальной медианы
    kernel_size = max(3, int(5 * sensitivity_multiplier))
    if kernel_size % 2 == 0:
        kernel_size += 1
    
    half_kernel = kernel_size // 2
    
    # Применяем итеративный процесс фильтрации
    for iteration in range(num_iterations):
        # Вычисляем локальную медиану (базовая поверхность) используя скользящее окно
        local_median = np.full_like(filtered_data, np.nan)
        
        height, width = filtered_data.shape
        for i in range(height):
            for j in range(width):
                if not valid_mask[i, j]:
                    continue
                
                # Определяем границы окна
                i_min = max(0, i - half_kernel)
                i_max = min(height, i + half_kernel + 1)
                j_min = max(0, j - half_kernel)
                j_max = min(width, j + half_kernel + 1)
                
                # Извлекаем окно
                window = filtered_data[i_min:i_max, j_min:j_max]
                window_valid = valid_mask[i_min:i_max, j_min:j_max]
                
                # Вычисляем медиану только для валидных значений
                if np.any(window_valid):
                    valid_values = window[window_valid]
                    local_median[i, j] = np.median(valid_values)
        
        # Вычисляем разницу между данными и базовой поверхностью
        diff = filtered_data - local_median
        
        # Определяем порог для удаления выступов
        # Используем стандартное отклонение для определения аномалий
        if np.any(valid_mask):
            valid_diff = diff[valid_mask & np.isfinite(local_median)]
            if len(valid_diff) > 0:
                std_dev = np.std(valid_diff)
                threshold = std_dev * sensitivity_multiplier
                
                # Удаляем пиксели, которые значительно выше базовой поверхности
                # (это могут быть здания или растительность)
                outliers = (diff > threshold) & valid_mask & np.isfinite(local_median)
                filtered_data[outliers] = local_median[outliers]
                
                # Обновляем маску валидных данных
                valid_mask = np.isfinite(filtered_data)
                
                if not np.any(valid_mask):
                    break
    
    return filtered_data


def apply_filter_to_geotiff_file(input_file_path: str, output_file_path: str, 
                                  filter_type: str, filter_params: Dict) -> None:
    """
    Применяет фильтр ко всему GeoTIFF файлу и сохраняет результат.
    Использует обработку в памяти для лучшей производительности.
    
    Args:
        input_file_path: Путь к исходному GeoTIFF файлу
        output_file_path: Путь для сохранения отфильтрованного файла
        filter_type: Тип фильтра ('DTM_FILTER', 'NOISE_FILTER', и т.д.)
        filter_params: Параметры фильтра
    """
    try:
        # Читаем файл в память
        with open(input_file_path, 'rb') as f:
            geotiff_bytes = f.read()
        
        # Применяем фильтр в зависимости от типа
        if filter_type == 'DTM_FILTER':
            sensitivity_multiplier = filter_params.get('sensitivityMultiplier', 1.0)
            num_iterations = filter_params.get('numberOfIterations', 200)
            base_threshold = filter_params.get('baseThreshold', 0.8)
            base_window = filter_params.get('baseWindow', 3)
            max_window = filter_params.get('maxWindow', 31)
            grow_every = filter_params.get('growEvery', 20)
            
            # Применяем фильтр в памяти
            filtered_bytes = apply_dtm_filter_geotiff_bytes(
                geotiff_bytes,
                sensitivity_multiplier=sensitivity_multiplier,
                iterations=num_iterations,
                base_threshold_m=base_threshold,
                base_window=base_window,
                max_window=max_window,
                grow_every=grow_every,
            )
        elif filter_type == 'BILATERAL_NOISE_FILTER':
            filter_size_pixels = filter_params.get('filterSizePixels', 10)
            spatial_tolerance = filter_params.get('spatialTolerance', 5.0)
            value_tolerance = filter_params.get('valueTolerance', 1.0)
            
            # Применяем bilateral noise filter в памяти
            filtered_bytes = apply_bilateral_noise_filter_geotiff_bytes(
                geotiff_bytes,
                filter_size_pixels=filter_size_pixels,
                spatial_tolerance=spatial_tolerance,
                value_tolerance=value_tolerance,
            )
        elif filter_type == 'HYDRO_CORRECTION':
            delta = filter_params.get('delta', 0.0)
            iterations = filter_params.get('numberOfIterations', 40)  # фронтенд передает numberOfIterations
            connectivity = filter_params.get('connectivity', 8)
            
            # Применяем гидрологическую коррекцию в памяти
            filtered_bytes = apply_hydrologic_correction_geotiff_bytes(
                geotiff_bytes,
                delta=delta,
                iterations=iterations,
                connectivity=connectivity,
            )
        elif filter_type == 'FILL_MISSING':
            method = filter_params.get('method', 'nearest')  # 'nearest' or 'ocean_edge'
            ocean_level = filter_params.get('oceanLevel', 0.0)  # используется только для ocean_edge
            connectivity = filter_params.get('connectivity', 8)
            
            # Применяем заполнение пропущенных значений в памяти
            filtered_bytes = fill_missing_values_geotiff_bytes(
                geotiff_bytes,
                method=method,
                ocean_level=ocean_level,
                connectivity=connectivity,
            )
        else:
            # Для других типов фильтров пока просто возвращаем исходные данные
            # TODO: Реализовать другие типы фильтров
            logging.warning(f"Тип фильтра {filter_type} еще не реализован, возвращаем исходные данные")
            filtered_bytes = geotiff_bytes
        
        # Сохраняем результат
        with open(output_file_path, 'wb') as f:
            f.write(filtered_bytes)
        
        logging.info(f"Фильтр {filter_type} успешно применен к файлу {input_file_path}, результат сохранен в {output_file_path}")
            
    except Exception as e:
        logging.error(f"Ошибка при применении фильтра к файлу {input_file_path}: {e}")
        raise


def generate_tile_from_geotiff(file_path: str, z: int, x: int, y: int, use_cache: bool = True, 
                                dtm_filter: Optional[Dict] = None) -> bytes:
    """
    Генерирует тайл изображения из GeoTIFF файла.
    
    Реализует Option B из документации Mapbox:
    - Хостинг тайлов на собственном сервере
    - Генерация тайлов на лету из GeoTIFF
    - Репроекция в EPSG:4326 (WGS84) для совместимости с Mapbox GL JS
    - Формат: XYZ tiles (z/x/y.png)
    
    Args:
        file_path: Путь к GeoTIFF файлу
        z: Уровень зума (zoom level)
        x: Координата X тайла
        y: Координата Y тайла (XYZ format, не TMS)
        use_cache: Использовать кэш тайлов для ускорения загрузки
        
    Returns:
        PNG изображение тайла в виде bytes
    """
    # Проверяем кэш перед генерацией
    # Включаем параметры фильтра в ключ кэша
    filter_key = None
    if dtm_filter:
        filter_key = (dtm_filter.get('sensitivityMultiplier', 1.0), dtm_filter.get('numberOfIterations', 200))
    cache_key = (file_path, z, x, y, filter_key)
    if use_cache and cache_key in _tile_cache:
        return _tile_cache[cache_key]
    
    try:
        import math
        
        with rasterio.open(file_path) as src:
            # Вычисляем границы тайла в координатах EPSG:4326 (WGS84)
            # Mapbox GL JS работает с EPSG:4326 для bounds, хотя тайлы обычно в EPSG:3857
            # Используем EPSG:4326 для упрощения и совместимости
            n = 2.0 ** z
            tile_left = (x / n) * 360.0 - 180.0
            tile_right = ((x + 1) / n) * 360.0 - 180.0
            tile_top = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
            tile_bottom = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
            
            # Получаем границы источника в его собственной CRS
            src_bounds = src.bounds
            
            # Преобразуем границы источника в EPSG:4326 для корректного сравнения
            from rasterio.warp import transform_bounds
            src_crs = src.crs if src.crs else 'EPSG:4326'
            
            # Проверяем, нужно ли преобразование
            if src_crs and str(src_crs).upper() == 'EPSG:4326':
                # Уже в EPSG:4326, преобразование не требуется
                src_left_4326 = src_bounds.left
                src_bottom_4326 = src_bounds.bottom
                src_right_4326 = src_bounds.right
                src_top_4326 = src_bounds.top
            else:
                # Нужно преобразование
                try:
                    src_bounds_4326 = transform_bounds(
                        src_crs,
                        'EPSG:4326',
                        src_bounds.left,
                        src_bounds.bottom,
                        src_bounds.right,
                        src_bounds.top
                    )
                    src_left_4326, src_bottom_4326, src_right_4326, src_top_4326 = src_bounds_4326
                except Exception as e:
                    logging.warning(f"Не удалось преобразовать границы в EPSG:4326: {e}, используем исходные границы")
                    # Если преобразование не удалось, используем исходные границы
                    # Это может привести к неточностям, но лучше, чем полный отказ
                    src_left_4326 = src_bounds.left
                    src_bottom_4326 = src_bounds.bottom
                    src_right_4326 = src_bounds.right
                    src_top_4326 = src_bounds.top
            
            # Проверяем, пересекается ли тайл с данными (используя координаты в EPSG:4326)
            if (tile_right < src_left_4326 or tile_left > src_right_4326 or
                tile_bottom > src_top_4326 or tile_top < src_bottom_4326):
                # Тайл не пересекается с данными, возвращаем прозрачный тайл
                logging.debug(f"Тайл z={z}, x={x}, y={y} не пересекается с данными")
                img = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
                output = io.BytesIO()
                img.save(output, format='PNG', optimize=True)
                transparent_tile = output.getvalue()
                
                # Кэшируем прозрачный тайл тоже
                if use_cache:
                    filter_key = None
                    if dtm_filter:
                        filter_key = (dtm_filter.get('sensitivityMultiplier', 1.0), dtm_filter.get('numberOfIterations', 200))
                    cache_key = (file_path, z, x, y, filter_key)
                    if len(_tile_cache) >= MAX_TILE_CACHE_SIZE:
                        keys_to_remove = list(_tile_cache.keys())[:MAX_TILE_CACHE_SIZE // 10]
                        for key in keys_to_remove:
                            _tile_cache.pop(key, None)
                    _tile_cache[cache_key] = transparent_tile
                
                return transparent_tile
            
            logging.debug(f"Тайл z={z}, x={x}, y={y} пересекается с данными, генерируем изображение")
            
            # Репроектируем данные для тайла в EPSG:4326
            dst_crs = 'EPSG:4326'
            transform, width, height = calculate_default_transform(
                src.crs, dst_crs, 256, 256,
                left=tile_left, bottom=tile_bottom,
                right=tile_right, top=tile_top
            )
            
            # Читаем данные с репроекцией
            # Используем NaN для областей без данных (nodata)
            data = np.full((height, width), np.nan, dtype=np.float32)
            
            # Получаем nodata значение из исходного файла (если есть)
            src_nodata = src.nodata
            if src_nodata is None:
                src_nodata = np.nan
            
            reproject(
                source=rasterio.band(src, 1),
                destination=data,
                src_transform=src.transform,
                src_crs=src.crs,
                src_nodata=src_nodata,
                dst_transform=transform,
                dst_crs=dst_crs,
                resampling=Resampling.bilinear,
                dst_nodata=np.nan
            )
            
            # Применяем DTM фильтр, если указан
            if dtm_filter and dtm_filter.get('enabled', False):
                sensitivity_multiplier = dtm_filter.get('sensitivityMultiplier', 1.0)
                num_iterations = dtm_filter.get('numberOfIterations', 200)
                try:
                    data = apply_dtm_filter(data, sensitivity_multiplier, num_iterations)
                    logging.debug(f"Применен DTM фильтр к тайлу z={z}, x={x}, y={y}")
                except Exception as e:
                    logging.warning(f"Ошибка при применении DTM фильтра: {e}")
            
            # Нормализуем данные для визуализации
            valid_mask = None
            if data.size > 0:
                # Определяем валидные (не-NaN) значения
                valid_mask = np.isfinite(data)
                
                if np.any(valid_mask):
                    # Используем только валидные значения для нормализации
                    valid_data = data[valid_mask]
                    data_min = np.min(valid_data)
                    data_max = np.max(valid_data)
                    
                    logging.debug(f"Тайл z={z}, x={x}, y={y}: мин={data_min:.2f}, макс={data_max:.2f}, валидных пикселей={np.sum(valid_mask)}/{data.size}")
                    
                    if data_max > data_min:
                        # Нормализуем данные в диапазон [0, 1]
                        normalized_data = np.zeros_like(data, dtype=np.float32)
                        normalized_data[valid_mask] = (valid_data - data_min) / (data_max - data_min)
                        # Значения вне валидной области остаются 0 (NaN не включены)
                    else:
                        # Все валидные значения одинаковые
                        normalized_data = np.zeros_like(data, dtype=np.float32)
                        normalized_data[valid_mask] = 0.5
                        logging.debug(f"Тайл z={z}, x={x}, y={y}: все валидные значения одинаковые ({data_min:.2f})")
                else:
                    # Нет валидных данных (все NaN)
                    logging.warning(f"Тайл z={z}, x={x}, y={y}: нет валидных данных (все значения NaN)")
                    normalized_data = np.zeros_like(data, dtype=np.float32)
                    valid_mask = np.zeros_like(data, dtype=bool)
            else:
                logging.warning(f"Тайл z={z}, x={x}, y={y}: пустой массив данных")
                normalized_data = np.zeros((256, 256), dtype=np.float32)
                valid_mask = np.zeros((256, 256), dtype=bool)
            
            # Применяем цветовую карту для визуализации рельефа
            try:
                from matplotlib import cm
                # Пытаемся использовать новый API, если доступен
                try:
                    colormap = cm.get_cmap('terrain')
                except (AttributeError, ValueError):
                    # Fallback для старых версий matplotlib
                    colormap = cm.terrain
                
                # Применяем colormap
                colored = colormap(normalized_data)
                # Конвертируем в RGBA и затем в uint8
                rgba = (colored[:, :, :4] * 255).astype(np.uint8)
                
                # Устанавливаем прозрачность для пикселей без данных
                if valid_mask is not None:
                    rgba[:, :, 3] = np.where(valid_mask, rgba[:, :, 3], 0)
            except (ImportError, Exception):
                # Если matplotlib не доступен или произошла ошибка, используем простую градацию серого
                gray = (normalized_data * 255).astype(np.uint8)
                rgba = np.zeros((*gray.shape, 4), dtype=np.uint8)
                rgba[:, :, 0] = gray
                rgba[:, :, 1] = gray
                rgba[:, :, 2] = gray
                # Устанавливаем прозрачность для пикселей без данных
                if valid_mask is not None:
                    rgba[:, :, 3] = np.where(valid_mask, 255, 0)
                else:
                    rgba[:, :, 3] = 255
            
            # Создаем изображение
            img = Image.fromarray(rgba, 'RGBA')
            
            # Сохраняем в PNG с оптимизацией для быстрой загрузки
            output = io.BytesIO()
            # Используем оптимизацию PNG для уменьшения размера и ускорения загрузки
            img.save(output, format='PNG', optimize=True, compress_level=6)
            tile_data = output.getvalue()
            
            # Сохраняем в кэш для ускорения последующих запросов
            if use_cache:
                filter_key = None
                if dtm_filter:
                    filter_key = (dtm_filter.get('sensitivityMultiplier', 1.0), dtm_filter.get('numberOfIterations', 200))
                cache_key = (file_path, z, x, y, filter_key)
                # Очищаем кэш если он слишком большой (FIFO)
                if len(_tile_cache) >= MAX_TILE_CACHE_SIZE:
                    # Удаляем первые 10% записей (старые)
                    keys_to_remove = list(_tile_cache.keys())[:MAX_TILE_CACHE_SIZE // 10]
                    for key in keys_to_remove:
                        _tile_cache.pop(key, None)
                
                _tile_cache[cache_key] = tile_data
            
            return tile_data
            
    except Exception as e:
        logging.error(f"Error generating tile from {file_path} for z={z}, x={x}, y={y}: {e}")
        # Возвращаем прозрачный тайл при ошибке
        img = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
        output = io.BytesIO()
        img.save(output, format='PNG')
        return output.getvalue()


MAX_BYTES = 250 * 1024 * 1024  # 250 MB


@router.post(
    "/noise-filter/bilateral",
    summary="Bilateral noise filter",
    description="Применяет bilateral noise filter к загруженному GeoTIFF файлу для удаления шума при сохранении границ. Фильтр учитывает как пространственную близость, так и схожесть значений. Возвращает обработанный GeoTIFF файл."
)
async def bilateral_noise_filter_endpoint(
    file: UploadFile = File(...),
    filter_size_pixels: int = Form(10),
    spatial_tolerance: float = Form(5.0),
    value_tolerance: float = Form(1.0),
    user: User = Depends(get_current_user),
):
    """
    Применяет bilateral noise filter к загруженному GeoTIFF файлу.
    Возвращает обработанный GeoTIFF файл.
    
    Args:
        file: Загружаемый GeoTIFF файл
        filter_size_pixels: Размер фильтра в пикселях (будет сделан нечетным)
        spatial_tolerance: Пространственная толерантность (sigma_spatial) в пикселях
        value_tolerance: Толерантность значений (sigma_color) в единицах высоты (метры)
        
    Returns:
        Обработанный GeoTIFF файл
    """
    if not (file.filename or "").lower().endswith((".tif", ".tiff")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Поддерживаются только файлы GeoTIFF (.tif/.tiff)"
        )

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Файл слишком большой (максимум 250 MB)"
        )

    try:
        out_bytes = apply_bilateral_noise_filter_geotiff_bytes(
            data,
            filter_size_pixels=filter_size_pixels,
            spatial_tolerance=spatial_tolerance,
            value_tolerance=value_tolerance,
        )
    except Exception as e:
        logging.error(f"Ошибка при применении bilateral noise filter: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка обработки: {type(e).__name__}: {str(e)}"
        )

    out_name = (file.filename.rsplit(".", 1)[0] + "_DENOISED.tif") if file.filename else "output_DENOISED.tif"
    headers = {"Content-Disposition": f'attachment; filename="{out_name}"'}

    return Response(content=out_bytes, media_type="application/x-geotiff", headers=headers)


@router.post(
    "/hydro-correction",
    summary="Гидрологическая коррекция",
    description="Применяет гидрологическую коррекцию (заполнение впадин) к загруженному GeoTIFF файлу. Использует алгоритм Priority-Flood для заполнения локальных впадин в данных рельефа, что необходимо для корректного моделирования стока воды."
)
async def hydro_correction_endpoint(
    file: UploadFile = File(...),
    delta: float = Form(0.0),
    iterations: int = Form(40),  # accepted for UI compatibility
    connectivity: int = Form(8),
    user: User = Depends(get_current_user),
):
    """
    Применяет гидрологическую коррекцию (заполнение впадин) к загруженному GeoTIFF файлу.
    Использует алгоритм Priority-Flood для заполнения локальных впадин.
    
    Args:
        file: Загружаемый GeoTIFF файл
        delta: Минимальное увеличение высоты на единицу расстояния между пикселями.
               Если delta > 0, заполненные ячейки поднимаются немного выше их пути стока (уменьшает плоские области).
               Типичные значения: 0.0 до 0.01 (в зависимости от разрешения и шума).
               0.0 = классическое плоское заполнение (может создавать большие плоские озера).
        iterations: Принимается для совместимости с UI; не используется алгоритмом Priority-Flood.
        connectivity: Количество соседей (4 или 8). По умолчанию 8.
        
    Returns:
        Обработанный GeoTIFF файл
    """
    if not (file.filename or "").lower().endswith((".tif", ".tiff")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Поддерживаются только файлы GeoTIFF (.tif/.tiff)"
        )

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Файл слишком большой (максимум 250 MB)"
        )

    if connectivity not in (4, 8):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="connectivity должен быть 4 или 8"
        )

    try:
        out_bytes = apply_hydrologic_correction_geotiff_bytes(
            data,
            delta=delta,
            iterations=iterations,
            connectivity=connectivity,
        )
    except Exception as e:
        logging.error(f"Ошибка при применении гидрологической коррекции: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка обработки: {type(e).__name__}: {str(e)}"
        )

    out_name = (file.filename.rsplit(".", 1)[0] + "_HYDRO.tif") if file.filename else "output_HYDRO.tif"
    headers = {"Content-Disposition": f'attachment; filename="{out_name}"'}

    return Response(content=out_bytes, media_type="application/x-geotiff", headers=headers)


@router.post(
    "/fill-missing",
    summary="Заполнение пропущенных значений",
    description="Заполняет пропущенные значения (NoData/NaN) в загруженном GeoTIFF файле. Поддерживает два метода: 'nearest' (заполнение ближайшим соседом) и 'ocean_edge' (классификация пропущенных областей на границе как океан). Возвращает обработанный GeoTIFF файл."
)
async def fill_missing_endpoint(
    file: UploadFile = File(...),
    method: str = Form("nearest"),          # "nearest" or "ocean_edge"
    ocean_level: float = Form(0.0),         # используется только для ocean_edge
    connectivity: int = Form(8),
    user: User = Depends(get_current_user),
):
    """
    Заполняет пропущенные значения (NoData/NaN) в загруженном GeoTIFF файле.
    Поддерживает два метода:
    1. nearest: заполняет каждый пропущенный пиксель значением ближайшего валидного пикселя (быстро, детерминировано)
    2. ocean_edge: классифицирует пропущенные области, соединенные с границей растра, как океан 
       и заполняет их ocean_level, затем заполняет оставшиеся внутренние дыры ближайшим соседом
    
    Args:
        file: Загружаемый GeoTIFF файл
        method: Метод заполнения ("nearest" или "ocean_edge")
        ocean_level: Уровень моря для метода ocean_edge (по умолчанию 0.0, в единицах высоты растра)
        connectivity: Связность для метода ocean_edge (4 или 8 соседей). По умолчанию 8.
        
    Returns:
        Обработанный GeoTIFF файл с заполненными пропущенными значениями
    """
    if not (file.filename or "").lower().endswith((".tif", ".tiff")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Поддерживаются только файлы GeoTIFF (.tif/.tiff)"
        )

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Файл слишком большой (максимум 250 MB)"
        )

    method = method.strip().lower()
    if method not in ("nearest", "ocean_edge"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="method должен быть 'nearest' или 'ocean_edge'"
        )

    if connectivity not in (4, 8):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="connectivity должен быть 4 или 8"
        )

    try:
        out_bytes = fill_missing_values_geotiff_bytes(
            data,
            method=method,
            ocean_level=ocean_level,
            connectivity=connectivity,
        )
    except Exception as e:
        logging.error(f"Ошибка при заполнении пропущенных значений: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка обработки: {type(e).__name__}: {str(e)}"
        )

    suffix = "_FILLED_NEAREST" if method == "nearest" else "_FILLED_OCEAN"
    out_name = (file.filename.rsplit(".", 1)[0] + f"{suffix}.tif") if file.filename else f"output{suffix}.tif"
    headers = {"Content-Disposition": f'attachment; filename="{out_name}"'}

    return Response(content=out_bytes, media_type="application/x-geotiff", headers=headers)


@router.post(
    "/projects",
    summary="Создать проект моделирования наводнений",
    description="Создает новый проект для моделирования наводнений. Проект используется для хранения загруженных файлов рельефа и параметров симуляции. Возвращает ID созданного проекта."
)
async def create_flood_project(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Создает новый проект для моделирования наводнений."""
    global next_project_id
    
    project_id = next_project_id
    next_project_id += 1
    
    flood_projects[project_id] = {
        'id': project_id,
        'owner_id': user.id,
        'created_at': None,
    }
    
    logging.info(f"Created flood project {project_id} for user {user.id}")
    
    return {"projectId": project_id}


@router.post(
    "/projects/{project_id}/upload",
    summary="Загрузить файл рельефа",
    description="Загружает файл рельефа (GeoTIFF) для проекта моделирования наводнений. Сохраняет файл на сервере, извлекает границы из файла. Поддерживает форматы .tif, .tiff, .geotiff. Возвращает ID файла и границы."
)
async def upload_terrain_file(
    project_id: int,
    file: UploadFile = File(...),
    kind: str = Form(...),
    bounds: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Загружает файл рельефа для проекта."""
    # Проверяем, существует ли проект
    if project_id not in flood_projects:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден"
        )
    
    project = flood_projects[project_id]
    if project['owner_id'] != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещен"
        )
    
    # Проверяем тип файла
    if kind != 'terrain':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Поддерживается только kind='terrain'"
        )
    
    # Проверяем расширение файла
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Имя файла не указано"
        )
    
    filename_lower = file.filename.lower()
    if not (filename_lower.endswith('.tif') or filename_lower.endswith('.tiff') or filename_lower.endswith('.geotiff')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Поддерживаются только файлы формата .tif, .tiff или .geotiff"
        )
    
    # Генерируем уникальное имя файла
    file_id = str(uuid.uuid4())
    file_extension = os.path.splitext(file.filename)[1] or '.tif'
    saved_filename = f"{file_id}{file_extension}"
    file_path = get_terrain_file_path(saved_filename)
    
    # Сохраняем файл
    try:
        with open(file_path, 'wb') as f:
            content = await file.read()
            f.write(content)
    except Exception as e:
        logging.error(f"Error saving terrain file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при сохранении файла: {str(e)}"
        )
    
    # Извлекаем границы из файла
    try:
        file_bounds = get_terrain_bounds(str(file_path))
    except Exception as e:
        logging.error(f"Error extracting bounds from terrain file: {e}")
        # Если не удалось извлечь из файла, используем переданные bounds
        if bounds:
            try:
                file_bounds = json.loads(bounds)
            except:
                file_bounds = None
        else:
            file_bounds = None
    
    # Сохраняем информацию о файле
    terrain_files[file_id] = {
        'id': file_id,
        'project_id': project_id,
        'filepath': str(file_path),
        'original_filename': file.filename,
        'bounds': file_bounds,
    }
    
    logging.info(f"Uploaded terrain file {file_id} for project {project_id}")
    
    return {"fileId": file_id, "bounds": file_bounds}


@router.post(
    "/projects/{project_id}/files/{file_id}/apply-filter",
    summary="Применить фильтр к файлу",
    description="Применяет фильтр к файлу рельефа и обновляет файл в базе данных. Поддерживает различные типы фильтров: DTM_FILTER, BILATERAL_NOISE_FILTER, HYDRO_CORRECTION, FILL_MISSING. Параметры фильтра передаются в формате JSON."
)
async def apply_filter_to_file(
    project_id: int,
    file_id: str,
    filter_type: str = Form(...),
    filter_params: str = Form(...),  # JSON строка с параметрами фильтра
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Применяет фильтр к файлу рельефа и обновляет файл в БД.
    """
    # Проверяем, существует ли проект
    if project_id not in flood_projects:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден"
        )
    
    project = flood_projects[project_id]
    if project['owner_id'] != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещен"
        )
    
    # Проверяем, существует ли файл
    if file_id not in terrain_files:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл рельефа не найден"
        )
    
    terrain_file = terrain_files[file_id]
    if terrain_file['project_id'] != project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Файл не принадлежит данному проекту"
        )
    
    # Парсим параметры фильтра
    try:
        filter_params_dict = json.loads(filter_params)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный формат параметров фильтра (должен быть JSON)"
        )
    
    # Применяем фильтр к файлу
    input_file_path = terrain_file['filepath']
    
    # Создаем временный файл для результата
    temp_file_id = str(uuid.uuid4())
    file_extension = os.path.splitext(input_file_path)[1] or '.tif'
    temp_filename = f"{temp_file_id}{file_extension}"
    temp_file_path = get_terrain_file_path(temp_filename)
    
    try:
        # Применяем фильтр
        apply_filter_to_geotiff_file(input_file_path, temp_file_path, filter_type, filter_params_dict)
        
        # Заменяем старый файл новым
        # Удаляем старый файл
        try:
            if os.path.exists(input_file_path):
                os.remove(input_file_path)
        except Exception as e:
            logging.warning(f"Не удалось удалить старый файл {input_file_path}: {e}")
        
        # Переименовываем временный файл в основной
        os.rename(temp_file_path, input_file_path)
        
        # Обновляем информацию о файле в БД
        terrain_file['filepath'] = str(input_file_path)
        
        # Обновляем границы файла (они могут измениться после фильтрации)
        try:
            file_bounds = get_terrain_bounds(str(input_file_path))
            terrain_file['bounds'] = file_bounds
        except Exception as e:
            logging.warning(f"Не удалось обновить границы файла: {e}")
        
        logging.info(f"Фильтр {filter_type} успешно применен к файлу {file_id} проекта {project_id}")
        
        return {"fileId": file_id, "bounds": terrain_file.get('bounds')}
        
    except Exception as e:
        # Удаляем временный файл в случае ошибки
        try:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
        except:
            pass
        
        logging.error(f"Ошибка при применении фильтра к файлу {file_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при применении фильтра: {str(e)}"
        )


@router.get(
    "/projects/{project_id}/files/{file_id}/download",
    summary="Скачать файл рельефа",
    description="Скачивает файл рельефа после применения фильтров. Возвращает обработанный GeoTIFF файл. Используется для получения финального файла после всех обработок для дальнейшего использования."
)
async def download_terrain_file(
    project_id: int,
    file_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Скачивает файл рельефа после применения фильтров.
    """
    # Проверяем, существует ли проект
    if project_id not in flood_projects:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден"
        )
    
    project = flood_projects[project_id]
    if project['owner_id'] != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещен"
        )
    
    # Проверяем, существует ли файл
    if file_id not in terrain_files:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл рельефа не найден"
        )
    
    terrain_file = terrain_files[file_id]
    if terrain_file['project_id'] != project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Файл не принадлежит данному проекту"
        )
    
    file_path = terrain_file['filepath']
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден на сервере"
        )
    
    # Читаем файл
    try:
        with open(file_path, 'rb') as f:
            file_content = f.read()
        
        # Определяем имя файла
        filename = os.path.basename(file_path)
        if not filename:
            filename = f"terrain_{file_id}.tif"
        
        return Response(
            content=file_content,
            media_type="image/tiff",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Access-Control-Allow-Origin": "*",
            }
        )
    except Exception as e:
        logging.error(f"Ошибка при чтении файла {file_path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при чтении файла: {str(e)}"
        )


@router.get(
    "/projects/{project_id}/tiles/{z}/{x}/{y}.png",
    summary="Получить тайл рельефа",
    description="Возвращает тайл рельефа для проекта в формате XYZ tiles (z/x/y.png). Генерирует тайл на лету из GeoTIFF файла с применением опционального DTM фильтра. Формат PNG 256x256 пикселей. Поддерживает кэширование для ускорения загрузки."
)
async def get_terrain_tile(
    project_id: int,
    z: int,
    x: int,
    y: int,
    layer: str = Query(...),
    fileId: str = Query(..., alias="fileId"),
    dtmSensitivity: Optional[float] = Query(None, alias="dtmSensitivity"),
    dtmIterations: Optional[int] = Query(None, alias="dtmIterations"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Возвращает тайл рельефа для проекта.
    
    Реализует XYZ tile server для отображения GeoTIFF на Mapbox карте.
    Формат URL соответствует стандарту XYZ tiles: /{z}/{x}/{y}.png
    
    Args:
        project_id: ID проекта
        z: Уровень зума (zoom level)
        x: Координата X тайла
        y: Координата Y тайла (XYZ format)
        layer: Тип слоя (должен быть 'terrain')
        fileId: ID загруженного файла рельефа
        
    Returns:
        PNG изображение тайла (256x256 пикселей)
    """
    # Проверяем, существует ли проект
    if project_id not in flood_projects:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден"
        )
    
    project = flood_projects[project_id]
    if project['owner_id'] != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещен"
        )
    
    # Проверяем, существует ли файл
    if fileId not in terrain_files:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл рельефа не найден"
        )
    
    terrain_file = terrain_files[fileId]
    if terrain_file['project_id'] != project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Файл не принадлежит данному проекту"
        )
    
    # Подготавливаем параметры DTM фильтра
    dtm_filter = None
    if dtmSensitivity is not None and dtmIterations is not None:
        dtm_filter = {
            'enabled': True,
            'sensitivityMultiplier': float(dtmSensitivity),
            'numberOfIterations': int(dtmIterations)
        }
    
    # Генерируем тайл
    try:
        tile_data = generate_tile_from_geotiff(terrain_file['filepath'], z, x, y, dtm_filter=dtm_filter)
        
        # Определяем заголовки кэширования в зависимости от наличия фильтра
        # Если фильтр применен, не кэшируем тайлы, чтобы всегда показывать актуальные данные
        if dtm_filter and dtm_filter.get('enabled', False):
            cache_control = "no-cache, no-store, must-revalidate"  # Не кэшируем тайлы с фильтрами
        else:
            cache_control = "public, max-age=86400"  # Кэшируем тайлы без фильтров на 24 часа
        
        return Response(
            content=tile_data,
            media_type="image/png",
            headers={
                "Cache-Control": cache_control,
                "Access-Control-Allow-Origin": "*",  # CORS для Mapbox
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                # Дополнительные заголовки для оптимизации
                "X-Content-Type-Options": "nosniff",
            }
        )
    except Exception as e:
        logging.error(f"Error generating terrain tile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при генерации тайла: {str(e)}"
        )


@router.post(
    "/projects/{project_id}/share",
    summary="Создать публичную ссылку для проекта",
    description="Генерирует или возвращает существующий share_hash для flood проекта. Сохраняет данные о файлах и параметрах симуляции для последующего восстановления. Если regenerate=True, всегда генерирует новый share_hash. Возвращает share_hash для создания публичной ссылки."
)
async def generate_flood_share_hash(
    project_id: int,
    regenerate: bool = Query(False),
    request_data: Optional[Dict] = Body(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Генерирует или возвращает существующий share_hash для flood проекта.
    Сохраняет данные о файлах и параметрах симуляции для последующего восстановления.
    Если regenerate=True, всегда генерирует новый share_hash.
    Возвращает share_hash для создания публичной ссылки.
    """
    # Проверяем, существует ли проект в памяти (для обратной совместимости)
    project = None
    if project_id in flood_projects:
        project = flood_projects[project_id]
    elif str(project_id) in flood_projects:
        project = flood_projects[str(project_id)]
    
    if not project:
        logging.warning(f"Проект {project_id} не найден в flood_projects. Доступные проекты: {list(flood_projects.keys())}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Проект {project_id} не найден. Убедитесь, что вы загрузили файл рельефа."
        )
    
    if project['owner_id'] != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещен"
        )
    
    # Парсим данные симуляции
    simulation_params = None
    if request_data and 'simulation_data' in request_data:
        try:
            simulation_data_str = request_data.get('simulation_data')
            if isinstance(simulation_data_str, str):
                simulation_params = json.loads(simulation_data_str)
            else:
                simulation_params = simulation_data_str
            logging.info(f"Сохранены данные симуляции для проекта {project_id}: {list(simulation_params.keys())}")
        except (json.JSONDecodeError, TypeError) as e:
            logging.warning(f"Не удалось распарсить simulation_data: {e}")
    
    # Собираем информацию о файлах проекта
    project_files = []
    for file_id, file_info in terrain_files.items():
        if file_info.get('project_id') == project_id:
            project_files.append({
                'file_id': file_id,
                'filepath': file_info.get('filepath'),
                'original_filename': file_info.get('original_filename'),
                'bounds': file_info.get('bounds')
            })
    
    # Проверяем, есть ли проект в БД, если нет - создаем
    db_project = get_flood_project(db, project_id, user.id)
    if not db_project:
        # Создаем проект в БД с тем же ID, что и в памяти
        try:
            db_project = crud_create_flood_project(db, user.id, project_id=project_id)
            logging.info(f"Создан flood проект в БД: {db_project.id}")
        except Exception as e:
            # Если не удалось создать с указанным ID (например, конфликт), создаем без ID
            logging.warning(f"Не удалось создать проект с ID {project_id}, создаем с автоматическим ID: {e}")
            db_project = crud_create_flood_project(db, user.id)
            logging.info(f"Создан flood проект в БД с автоматическим ID: {db_project.id} (из памяти: {project_id})")
    
    # Сохраняем данные в БД
    share_hash = update_flood_project_share(
        db=db,
        project_id=db_project.id,
        owner_id=user.id,
        simulation_data=simulation_params,
        files_data=project_files,
        regenerate=regenerate
    )
    
    # Также обновляем в памяти для обратной совместимости
    project['share_hash'] = share_hash
    project['simulation_data'] = simulation_params
    project['files'] = project_files
    
    return {"share_hash": share_hash, "has_password": False}


@router.get(
    "/shared/{share_hash}",
    summary="Публичный доступ к flood проекту",
    description="Публичный доступ к flood проекту по share_hash (без авторизации). Возвращает данные проекта, файлы и параметры симуляции для восстановления. Используется для загрузки сохраненных проектов по публичной ссылке."
)
async def get_shared_flood_project(
    share_hash: str,
    db: Session = Depends(get_db),
):
    """
    Публичный доступ к flood проекту по share_hash (без авторизации).
    Возвращает данные проекта, файлы и параметры симуляции для восстановления.
    """
    # Сначала ищем в БД
    db_project = get_flood_project_by_share_hash(db, share_hash)
    
    if db_project:
        # Проект найден в БД
        return {
            "id": db_project.id,
            "share_hash": db_project.share_hash,
            "simulation_data": db_project.simulation_data or {},
            "files": db_project.files_data or []
        }
    
    # Если не найден в БД, ищем в памяти (для обратной совместимости)
    project = None
    for proj_id, proj_data in flood_projects.items():
        if proj_data.get('share_hash') == share_hash:
            project = proj_data.copy()
            project['id'] = proj_id
            break
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден"
        )
    
    return {
        "id": project['id'],
        "share_hash": project.get('share_hash'),
        "simulation_data": project.get('simulation_data', {}),
        "files": project.get('files', [])
    }


@router.get(
    "/shared/{share_hash}/files/{file_id}/download",
    summary="Скачать файл из публичного проекта",
    description="Скачивает файл рельефа из shared проекта. Не требует авторизации. Используется для получения файлов из публично расшаренных проектов моделирования наводнений."
)
async def download_shared_terrain_file(
    share_hash: str,
    file_id: str,
    db: Session = Depends(get_db),
):
    """
    Скачивает файл рельефа из shared проекта.
    """
    # Сначала проверяем в БД
    db_project = get_flood_project_by_share_hash(db, share_hash)
    
    # Если проект найден в БД, ищем файл в files_data
    if db_project and db_project.files_data:
        for file_info in db_project.files_data:
            if file_info.get('file_id') == file_id:
                file_path = file_info.get('filepath')
                if file_path and os.path.exists(file_path):
                    try:
                        with open(file_path, 'rb') as f:
                            file_content = f.read()
                        original_filename = file_info.get('original_filename', 'terrain.tif')
                        return Response(
                            content=file_content,
                            media_type="application/x-geotiff",
                            headers={"Content-Disposition": f'attachment; filename="{original_filename}"'}
                        )
                    except Exception as e:
                        logging.error(f"Ошибка при чтении файла {file_path}: {e}")
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Ошибка при чтении файла"
                        )
    
    # Если не найден в БД, ищем в памяти (для обратной совместимости)
    project = None
    for proj_id, proj_data in flood_projects.items():
        if proj_data.get('share_hash') == share_hash:
            project = proj_data
            break
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден"
        )
    
    # Проверяем, что файл принадлежит этому проекту
    if file_id not in terrain_files:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден"
        )
    
    terrain_file = terrain_files[file_id]
    if terrain_file.get('project_id') != project['id']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Файл не принадлежит этому проекту"
        )
    
    file_path = terrain_file['filepath']
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден на сервере"
        )
    
    # Читаем файл
    try:
        with open(file_path, 'rb') as f:
            file_content = f.read()
        
        filename = os.path.basename(file_path)
        if not filename:
            filename = f"terrain_{file_id}.tif"
        
        return Response(
            content=file_content,
            media_type="image/tiff",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Access-Control-Allow-Origin": "*",
            }
        )
    except Exception as e:
        logging.error(f"Ошибка при чтении файла {file_path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при чтении файла: {str(e)}"
        )

