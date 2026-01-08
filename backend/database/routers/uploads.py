# backend/database/routers/uploads.py

import os
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database.database import get_db
from database.routers.auth import get_current_user
from database import crud
from database.utils import load_metadata_from_db, parse_legends_from_metadata

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


@router.get(
    "/{upload_id}/legend",
    status_code=status.HTTP_200_OK,
    summary="Получить легенду проекта",
    description="Возвращает легенды из метаданных загруженного .db файла HEC-RAS проекта. Извлекает легенды напрямую из файла для гарантии актуальности данных. Возвращает структурированные данные с классами значений и цветами для визуализации на карте."
)
def get_upload_legend(
    upload_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Возвращает легенды из метаданных загруженного .db файла.
    
    Endpoint: GET /api/uploads/{upload_id}/legend
    
    Возвращает JSON:
    {
        "upload_id": "...",
        "mode": "metadata" | "empty",
        "legends": [
            {
                "key_prefix": "P",
                "title": "Depth",
                "classes": [
                    {"label": "0 - 0.5", "rgba": {"r": 156, "g": 21, "b": 31, "a": 255}, "hex": "#9C151F"}
                ]
            }
        ]
    }
    """
    # upload_id это project_id
    project = crud.get_hecras_project(db, upload_id, owner_id=user.id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден"
        )
    
    if not os.path.exists(project.filepath):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл проекта не найден"
        )
    
    # Загружаем метаданные напрямую из .db файла
    # Это гарантирует, что мы всегда получаем актуальные данные из файла
    logging.info(f"Loading metadata from file: {project.filepath}")
    metadata = load_metadata_from_db(project.filepath)
    
    if not metadata:
        logging.warning(f"No metadata found in file: {project.filepath}")
        return {
            "upload_id": str(upload_id),
            "mode": "empty",
            "legends": []
        }
    
    logging.info(f"Loaded {len(metadata)} metadata keys from file")
    # Логируем ключи, связанные с легендой
    legend_keys = [k for k in metadata.keys() if 'legend' in k.lower()]
    logging.info(f"Legend-related keys found: {legend_keys}")
    
    # Парсим легенды из метаданных
    legends = parse_legends_from_metadata(metadata)
    
    logging.info(f"Parsed {len(legends)} legends from metadata")
    
    return {
        "upload_id": str(upload_id),
        "mode": "metadata" if legends else "empty",
        "legends": legends
    }

