# backend/database/routers/hec_ras.py

import os
import logging
import sqlite3
from typing import List, Optional
from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session

from database.schemas import HecRasSummary, HecRasOut
from database.database import get_db
from .auth import get_current_user
from database import crud
from database.utils import extract_hecras_data, detect_tile_schema
from database.file_paths import PROJECTS_DIR, get_project_path

router = APIRouter(prefix="/api/hec-ras", tags=["hec-ras"])


@router.get(
    "/",
    response_model=List[HecRasSummary],
    status_code=status.HTTP_200_OK,
    summary="Список HEC-RAS проектов",
    description="Возвращает список всех HEC-RAS проектов текущего авторизованного пользователя. Каждый проект содержит базовую информацию: ID, имя, дату создания."
)
def list_projects(
    db: Session = Depends(get_db),
    user      = Depends(get_current_user),
):
    """
    Возвращает список всех HEC-RAS проектов текущего пользователя.
    """
    return crud.list_hecras_projects(db, owner_id=user.id)


@router.get(
    "/{project_id}",
    response_model=HecRasOut,
    status_code=status.HTTP_200_OK,
    summary="Получить проект HEC-RAS",
    description="Возвращает подробную информацию о проекте HEC-RAS, включая метаданные и слои. Если метаданные отсутствуют, автоматически извлекает их из .db файла."
)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    user      = Depends(get_current_user),
):
    """
    Подробный просмотр одного проекта: метаданные + слои.
    Если метаданные и слои отсутствуют, извлекает их из .db файла.
    """
    project = crud.get_hecras_project(db, project_id, owner_id=user.id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден"
        )
    
    # Если метаданные или слои отсутствуют, извлекаем их из .db файла
    if (not project.project_metadata or not project.layers) and os.path.exists(project.filepath):
        hecras_data = extract_hecras_data(project.filepath)
        if hecras_data.get("metadata") or hecras_data.get("layers"):
            # Обновляем проект с извлеченными данными
            project.project_metadata = hecras_data.get("metadata", project.project_metadata or {})
            project.layers = hecras_data.get("layers", project.layers or [])
            db.commit()
            db.refresh(project)
    
    return project


@router.post(
    "/upload",
    response_model=HecRasSummary,
    status_code=status.HTTP_201_CREATED,
    summary="Загрузка HEC-RAS проекта",
    description="Загружает новый .db файл HEC-RAS проекта. Сохраняет файл на сервере, извлекает метаданные и слои из базы данных, создает запись в системе. Возвращает информацию о созданном проекте."
)
def upload_project(
    name: str           = Form(...),
    file: UploadFile    = File(...),
    db: Session         = Depends(get_db),
    user                = Depends(get_current_user),
):
    """
    Загрузка нового .db-файла HEC-RAS:
    — сохраняем файл в ./uploads/projects
    — создаём запись в БД через crud.create_hecras_project
    — возвращаем данные проекта (HecRasSummary)
    """
    try:
        file_path = get_project_path(f"{name}.db")
        file_path_str = str(file_path)
        with open(file_path_str, "wb") as buffer:
            buffer.write(file.file.read())

        # Извлекаем метаданные и слои из .db файла
        hecras_data = extract_hecras_data(file_path_str)
        extracted_metadata = hecras_data.get("metadata", {})
        extracted_layers = hecras_data.get("layers", [])
        
        # Логируем извлеченные метаданные для отладки
        logging.info(f"Extracted {len(extracted_metadata)} metadata entries for project {name}")
        if extracted_metadata:
            # Логируем ключи метаданных (первые 20 для краткости)
            metadata_keys = list(extracted_metadata.keys())
            logging.info(f"Metadata keys: {metadata_keys[:20]}...")
            # Проверяем наличие ключевых метаданных
            key_metadata = [k for k in metadata_keys if any(k.endswith(suffix) for suffix in ['_maxzoom', '_centerx', '_centery', '_centerz', '_project_name', '_plan_name', '_map_type', '_legend_values', '_legend_rgba'])]
            if key_metadata:
                logging.info(f"Found key metadata fields: {key_metadata}")
        
        project = crud.create_hecras_project(
            db,
            name=name,
            filepath=file_path_str,
            owner_id=user.id,
            original_filename=file.filename,
            metadata=extracted_metadata,
            layers=extracted_layers
        )
        return project

    except Exception as e:
        logging.exception("Ошибка при загрузке проекта")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось загрузить проект: {e}"
        )


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_200_OK,
    summary="Удаление HEC-RAS проекта",
    description="Удаляет проект HEC-RAS и связанный физический файл с сервера. Удаляет запись из базы данных. Операция необратима."
)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Удаляет проект HEC-RAS и физический файл.
    """
    project = crud.get_hecras_project(db, project_id, owner_id=user.id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден"
        )
    
    # Удаляем физический файл
    try:
        if os.path.exists(project.filepath):
            os.remove(project.filepath)
    except Exception as e:
        logging.warning(f"Не удалось удалить файл {project.filepath}: {e}")
    
    # Удаляем запись из БД
    success = crud.delete_hecras_project(db, project_id, owner_id=user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось удалить проект"
        )
    
    return {"message": "Проект успешно удалён"}


@router.patch(
    "/{project_id}/rename",
    response_model=HecRasSummary,
    status_code=status.HTTP_200_OK,
    summary="Переименование HEC-RAS проекта",
    description="Переименовывает проект HEC-RAS и соответствующий физический файл. Обновляет имя в базе данных и переименовывает файл на диске."
)
def rename_project(
    project_id: int,
    new_name: str = Form(...),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Переименовывает проект HEC-RAS и физический файл.
    """
    project = crud.get_hecras_project(db, project_id, owner_id=user.id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден"
        )
    
    # Переименовываем физический файл
    old_filepath = project.filepath
    new_filepath = str(get_project_path(f"{new_name}.db"))
    
    try:
        if os.path.exists(old_filepath) and old_filepath != new_filepath:
            os.rename(old_filepath, new_filepath)
            # Обновляем путь к файлу в БД
            project.filepath = new_filepath
    except Exception as e:
        logging.warning(f"Не удалось переименовать файл {old_filepath}: {e}")
    
    # Обновляем имя проекта и путь к файлу в БД
    updated_project = crud.update_hecras_project_name(
        db,
        project_id,
        owner_id=user.id,
        new_name=new_name,
        new_filepath=new_filepath if os.path.exists(new_filepath) else None
    )
    if not updated_project:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось переименовать проект"
        )
    
    return updated_project


@router.get(
    "/{project_id}/properties",
    status_code=status.HTTP_200_OK,
    summary="Получить свойства проекта",
    description="Возвращает все метаданные проекта HEC-RAS, включая размер файла, структурированные метаданные (временные шаги, zoom уровни, информацию о проекте, географию, легенду). Если метаданные отсутствуют, извлекает их из .db файла."
)
def get_project_properties(
    project_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Возвращает все метаданные проекта, включая размер файла и структурированные метаданные из .db файла.
    """
    project = crud.get_hecras_project(db, project_id, owner_id=user.id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден"
        )
    
    file_size = 0
    if os.path.exists(project.filepath):
        file_size = os.path.getsize(project.filepath)
    
    # Если метаданные отсутствуют, извлекаем их из .db файла
    metadata = project.project_metadata or {}
    layers = project.layers or []
    if (not metadata or not any(k.endswith('_legend_values') or k.endswith('_legend_rgba') for k in metadata.keys())) and os.path.exists(project.filepath):
        logging.info(f"Extracting metadata from {project.filepath}")
        hecras_data = extract_hecras_data(project.filepath)
        extracted_metadata = hecras_data.get("metadata", {})
        extracted_layers = hecras_data.get("layers", [])
        
        # Объединяем метаданные (извлеченные имеют приоритет)
        if extracted_metadata:
            metadata.update(extracted_metadata)
        if extracted_layers:
            layers = extracted_layers
        
        # Обновляем проект с извлеченными метаданными
        if extracted_metadata or extracted_layers:
            project.project_metadata = metadata
            project.layers = layers
            db.commit()
            db.refresh(project)
            logging.info(f"Updated project metadata, found legend keys: {[k for k in metadata.keys() if 'legend' in k.lower()]}")
    
    # Инициализируем переменные для структурированных данных
    times_info = None
    zoom_info = None
    tile_count = None
    project_info = None
    geography_info = None
    legend_info = None
    
    # Анализируем временные шаги из слоев
    if layers:
        times = [layer.get('time') for layer in layers if layer.get('time')]
        unique_times = sorted(set(times))
        if unique_times:
            times_info = {
                "count": len(unique_times),
                "times": unique_times,
                "first": unique_times[0] if unique_times else None,
                "last": unique_times[-1] if unique_times else None
            }
    
    # Анализируем zoom уровни из базы данных
    zoom_info = None
    tile_count = 0
    if os.path.exists(project.filepath):
        try:
            schema = detect_tile_schema(project.filepath)
            conn = sqlite3.connect(f"file:{project.filepath}?mode=ro", uri=True)
            conn.row_factory = sqlite3.Row
            try:
                table = schema['tile_table']
                z_col = schema['z_col']
                # Получаем min и max zoom
                cursor = conn.execute(f"SELECT MIN({z_col}) as min_z, MAX({z_col}) as max_z, COUNT(*) as total FROM {table}")
                zoom_data = cursor.fetchone()
                if zoom_data:
                    zoom_info = {
                        "min": int(zoom_data['min_z']) if zoom_data['min_z'] is not None else None,
                        "max": int(zoom_data['max_z']) if zoom_data['max_z'] is not None else None
                    }
                    tile_count = zoom_data['total'] if zoom_data['total'] else 0
            finally:
                conn.close()
        except Exception as e:
            logging.debug(f"Error analyzing zoom levels: {e}")
    
    # Извлекаем информацию о проекте из метаданных
    project_info = {}
    geography_info = {}
    legend_info = None
    
    logging.info(f"Extracting project info from metadata. Total keys: {len(metadata.keys())}")
    legend_keys = [k for k in metadata.keys() if 'legend' in k.lower()]
    logging.info(f"Legend-related keys found: {legend_keys}")
    
    # Ищем префикс слоя (например, "Maleevsk")
    layer_prefix = None
    for key in metadata.keys():
        if '_project_name' in key or '_plan_name' in key or '_map_type' in key:
            layer_prefix = key.split('_')[0]
            logging.info(f"Found layer prefix: {layer_prefix}")
            break
    
    if layer_prefix:
        project_info = {
            "project_name": metadata.get(f"{layer_prefix}_project_name"),
            "plan_name": metadata.get(f"{layer_prefix}_plan_name"),
            "map_type": metadata.get(f"{layer_prefix}_map_type")
        }
        
        geography_info = {
            "left": metadata.get(f"{layer_prefix}_left"),
            "right": metadata.get(f"{layer_prefix}_right"),
            "bottom": metadata.get(f"{layer_prefix}_bottom"),
            "top": metadata.get(f"{layer_prefix}_top"),
            "centerx": metadata.get(f"{layer_prefix}_centerx"),
            "centery": metadata.get(f"{layer_prefix}_centery"),
            "centerz": metadata.get(f"{layer_prefix}_centerz")
        }
        
        legend_values = metadata.get(f"{layer_prefix}_legend_values")
        legend_rgba = metadata.get(f"{layer_prefix}_legend_rgba")
        logging.info(f"Legend for prefix {layer_prefix}: values={legend_values is not None}, rgba={legend_rgba is not None}")
        if legend_values and legend_rgba:
            legend_info = {
                "values": legend_values,
                "rgba": legend_rgba
            }
            logging.info(f"Legend found by prefix: values={legend_values[:100] if legend_values else None}..., rgba={legend_rgba[:100] if legend_rgba else None}...")
    
    # Если легенда не найдена по префиксу, ищем любую легенду в метаданных
    if not legend_info:
        logging.info("Legend not found by prefix, searching all metadata keys...")
        for key in metadata.keys():
            if key.endswith('_legend_values'):
                base = key.replace('_legend_values', '')
                legend_values = metadata.get(key)
                legend_rgba = metadata.get(f"{base}_legend_rgba")
                logging.info(f"Found legend key: {key}, base={base}, values={legend_values is not None}, rgba={legend_rgba is not None}")
                if legend_values and legend_rgba:
                    legend_info = {
                        "values": legend_values,
                        "rgba": legend_rgba
                    }
                    logging.info(f"Legend found by key search: values={legend_values[:100] if legend_values else None}..., rgba={legend_rgba[:100] if legend_rgba else None}...")
                    break
    
    if not legend_info:
        logging.warning(f"No legend found in metadata. All keys: {list(metadata.keys())[:50]}")
    
    # Форматируем размер файла
    file_size_formatted = f"{file_size / 1024:.2f} KB" if file_size < 1024 * 1024 else f"{file_size / (1024 * 1024):.2f} MB"
    
    # Формируем ответ с базовыми данными и структурированными метаданными
    result = {
        "id": project.id,
        "name": project.name,
        "original_filename": project.original_filename,
        "created_at": project.created_at,
        "file_size": file_size,
        "file_size_formatted": file_size_formatted,
        "filepath": project.filepath,
        "metadata": metadata,  # Полные метаданные для совместимости
        "layers_count": len(layers),
        "structured_data": {
            "times": times_info,
            "zoom": zoom_info,
            "tile_count": tile_count,
            "project": project_info,
            "geography": geography_info,
            "legend": legend_info
        }
    }
    
    return result


@router.post(
    "/migrate-metadata",
    status_code=status.HTTP_200_OK,
    summary="Миграция метаданных проектов",
    description="Запускает миграцию метаданных для всех проектов текущего пользователя. Извлекает метаданные из .db файлов для проектов, у которых они отсутствуют или неполные. Возвращает статистику обновленных проектов."
)
def migrate_metadata(
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Запускает миграцию метаданных для всех проектов текущего пользователя.
    Извлекает метаданные из .db файлов для проектов, у которых они отсутствуют или неполные.
    """
    try:
        from database.models.hec_ras import HecRasProject
        import os
        
        # Получаем все проекты пользователя
        projects = db.query(HecRasProject).filter(HecRasProject.owner_id == user.id).all()
        logging.info(f"Найдено {len(projects)} проектов пользователя {user.id} для миграции")
        
        updated_count = 0
        skipped_count = 0
        error_count = 0
        errors = []
        
        for project in projects:
            logging.info(f"Обработка проекта ID={project.id}, name='{project.name}'")
            
            # Проверяем наличие файла
            if not project.filepath or not os.path.exists(project.filepath):
                logging.warning(f"Файл не найден для проекта ID={project.id}: {project.filepath}")
                skipped_count += 1
                continue
            
            # Проверяем, нужно ли обновлять метаданные
            needs_update = False
            
            if not project.project_metadata:
                needs_update = True
            else:
                # Проверяем наличие ключевых метаданных
                metadata = project.project_metadata
                has_metadata = any(
                    key.endswith(('_maxzoom', '_centerx', '_centery', '_centerz', 
                                 '_bottom', '_top', '_left', '_right',
                                 '_project_name', '_plan_name', '_map_type',
                                 '_legend_values', '_legend_rgba'))
                    for key in metadata.keys()
                )
                
                if not has_metadata:
                    needs_update = True
            
            if needs_update:
                try:
                    # Извлекаем метаданные из .db файла
                    hecras_data = extract_hecras_data(project.filepath)
                    
                    extracted_metadata = hecras_data.get("metadata", {})
                    extracted_layers = hecras_data.get("layers", [])
                    
                    if extracted_metadata or extracted_layers:
                        # Объединяем существующие метаданные с новыми
                        if project.project_metadata:
                            project.project_metadata.update(extracted_metadata)
                        else:
                            project.project_metadata = extracted_metadata
                        
                        if extracted_layers:
                            project.layers = extracted_layers
                        
                        db.commit()
                        db.refresh(project)
                        
                        logging.info(f"✅ Проект ID={project.id} успешно обновлен")
                        updated_count += 1
                    else:
                        logging.warning(f"⚠️  Не удалось извлечь метаданные из {project.filepath}")
                        error_count += 1
                        errors.append(f"Проект {project.name} (ID={project.id}): не удалось извлечь метаданные")
                        
                except Exception as e:
                    logging.error(f"❌ Ошибка при обработке проекта ID={project.id}: {e}")
                    error_count += 1
                    errors.append(f"Проект {project.name} (ID={project.id}): {str(e)}")
                    db.rollback()
            else:
                skipped_count += 1
        
        result = {
            "status": "completed",
            "total_projects": len(projects),
            "updated": updated_count,
            "skipped": skipped_count,
            "errors": error_count,
            "error_details": errors if errors else None
        }
        
        return result
        
    except Exception as e:
        logging.exception("Ошибка при миграции метаданных")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при миграции: {e}"
        )


@router.get(
    "/{project_id}/plans/{plan_name}/view",
    status_code=status.HTTP_200_OK,
    summary="Получить параметры просмотра плана",
    description="Возвращает параметры просмотра плана из метаданных проекта. Ищет ключ `${plan_name}_centerz` в метаданных и возвращает значение zoom для центрирования карты на плане."
)
def get_plan_view(
    project_id: int,
    plan_name: str,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Возвращает параметры просмотра плана из метаданных проекта.
    Ищет ключ `${plan_name}_centerz` в метаданных и возвращает значение zoom.
    """
    project = crud.get_hecras_project(db, project_id, owner_id=user.id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден"
        )
    
    # Получаем метаданные проекта
    metadata = project.project_metadata or {}
    
    # Если метаданные отсутствуют, пытаемся извлечь из .db файла
    if not metadata and os.path.exists(project.filepath):
        hecras_data = extract_hecras_data(project.filepath)
        metadata = hecras_data.get("metadata", {})
    
    # Ищем ключ `${plan_name}_centerz`
    centerz_key = f"{plan_name}_centerz"
    
    if centerz_key not in metadata:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ключ '{centerz_key}' не найден в метаданных проекта"
        )
    
    centerz_value = metadata[centerz_key]
    
    # Преобразуем в float
    try:
        # Если значение - строка, пытаемся распарсить
        if isinstance(centerz_value, str):
            centerz = float(centerz_value)
        elif isinstance(centerz_value, (int, float)):
            centerz = float(centerz_value)
        else:
            raise ValueError(f"Неожиданный тип значения: {type(centerz_value)}")
    except (ValueError, TypeError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Не удалось преобразовать значение '{centerz_value}' в число: {e}"
        )
    
    return {
        "plan": plan_name,
        "centerz": centerz
    }


@router.post(
    "/{project_id}/share",
    status_code=status.HTTP_200_OK,
    summary="Создать публичную ссылку",
    description="Генерирует или возвращает существующий share_hash для проекта. Если regenerate=True, всегда генерирует новый share_hash. Возвращает share_hash для создания публичной ссылки и информацию о наличии пароля."
)
def generate_share_hash(
    project_id: int,
    regenerate: bool = False,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Генерирует или возвращает существующий share_hash для проекта.
    Если regenerate=True, всегда генерирует новый share_hash.
    Возвращает share_hash для создания публичной ссылки.
    """
    if regenerate:
        share_hash = crud.regenerate_share_hash(db, project_id, user.id)
    else:
        share_hash = crud.get_or_create_share_hash(db, project_id, user.id)
    
    if not share_hash:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден"
        )
    
    # Получаем проект для проверки наличия пароля
    project = crud.get_hecras_project(db, project_id, user.id)
    has_password = project.share_password is not None if project else False
    
    return {"share_hash": share_hash, "has_password": has_password}


@router.delete(
    "/{project_id}/share",
    status_code=status.HTTP_200_OK,
    summary="Удалить публичную ссылку",
    description="Удаляет share_hash и пароль для проекта. После удаления публичная ссылка перестает работать."
)
def delete_share_hash(
    project_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Удаляет share_hash и пароль для проекта.
    """
    success = crud.delete_share_hash(db, project_id, user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден"
        )
    
    return {"message": "Ссылка успешно удалена"}


@router.patch(
    "/{project_id}/share",
    status_code=status.HTTP_200_OK,
    summary="Установить/удалить пароль для публичной ссылки",
    description="Устанавливает или удаляет пароль для share_hash проекта. Если password передан и не пустой - устанавливает пароль. Если password не передан или пустой - удаляет пароль. Для установки пароля сначала необходимо создать публичную ссылку."
)
def update_share_password(
    project_id: int,
    password: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Устанавливает или удаляет пароль для share_hash проекта.
    Если password передан и не пустой - устанавливает пароль.
    Если password не передан или пустой - удаляет пароль.
    """
    project = crud.get_hecras_project(db, project_id, user.id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден"
        )
    
    if not project.share_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сначала создайте ссылку для проекта"
        )
    
    if password and password.strip():
        # Устанавливаем пароль
        success = crud.set_share_password(db, project_id, user.id, password.strip())
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось установить пароль"
            )
        return {"message": "Пароль успешно установлен", "has_password": True}
    else:
        # Удаляем пароль
        success = crud.remove_share_password(db, project_id, user.id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось удалить пароль"
            )
        return {"message": "Пароль успешно удален", "has_password": False}


@router.post(
    "/shared/{share_hash}/verify-password",
    status_code=status.HTTP_200_OK,
    summary="Проверка пароля для публичного доступа",
    description="Проверяет пароль для доступа к проекту по share_hash. Возвращает success: true если пароль верный или пароль не установлен. Используется перед загрузкой защищенного паролем проекта."
)
def verify_share_password(
    share_hash: str,
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    """
    Проверяет пароль для доступа к проекту по share_hash.
    Возвращает success: true если пароль верный или пароль не установлен.
    """
    project = crud.get_project_by_share_hash(db, share_hash)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден"
        )
    
    # Если пароль не установлен, доступ разрешен
    if not project.share_password:
        return {"success": True, "message": "Пароль не требуется"}
    
    # Проверяем пароль
    is_valid = crud.verify_share_password(db, share_hash, password)
    if is_valid:
        return {"success": True, "message": "Пароль верный"}
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный пароль"
        )


@router.get(
    "/shared/{share_hash}",
    response_model=HecRasOut,
    status_code=status.HTTP_200_OK,
    summary="Публичный доступ к проекту",
    description="Публичный доступ к проекту по share_hash (без авторизации). Возвращает данные проекта для просмотра. Если установлен пароль, требуется передать его через query parameter. Если метаданные отсутствуют, автоматически извлекает их из .db файла."
)
def get_shared_project(
    share_hash: str,
    password: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Публичный доступ к проекту по share_hash (без авторизации).
    Возвращает данные проекта для просмотра.
    Если установлен пароль, требуется передать его через query parameter.
    """
    project = crud.get_project_by_share_hash(db, share_hash)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден"
        )
    
    # Если установлен пароль, проверяем его
    if project.share_password:
        if not password:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Для доступа к проекту требуется пароль"
            )
        
        is_valid = crud.verify_share_password(db, share_hash, password)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный пароль"
            )
    
    # Если метаданные или слои отсутствуют, извлекаем их из .db файла
    if (not project.project_metadata or not project.layers) and os.path.exists(project.filepath):
        hecras_data = extract_hecras_data(project.filepath)
        if hecras_data.get("metadata") or hecras_data.get("layers"):
            # Обновляем проект с извлеченными данными
            project.project_metadata = hecras_data.get("metadata", project.project_metadata or {})
            project.layers = hecras_data.get("layers", project.layers or [])
            db.commit()
            db.refresh(project)
    
    return project


@router.get(
    "/shared/{share_hash}/info",
    status_code=status.HTTP_200_OK,
    summary="Информация о публичном проекте",
    description="Возвращает базовую информацию о проекте по share_hash (без данных проекта). Используется для проверки наличия пароля перед загрузкой полных данных проекта. Не требует авторизации."
)
def get_shared_project_info(
    share_hash: str,
    db: Session = Depends(get_db),
):
    """
    Возвращает информацию о проекте по share_hash (без данных проекта).
    Используется для проверки наличия пароля перед загрузкой проекта.
    """
    project = crud.get_project_by_share_hash(db, share_hash)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден"
        )
    
    return {
        "id": project.id,
        "name": project.name,
        "has_password": project.share_password is not None
    }