# backend/database/routers/hec_ras.py

import os
import logging
from typing import List

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session

from database.schemas import HecRasSummary, HecRasOut
from database.database import get_db
from .auth import get_current_user
from database import crud

router = APIRouter(prefix="/api/hec-ras", tags=["hec-ras"])


@router.get(
    "/",
    response_model=List[HecRasSummary],
    status_code=status.HTTP_200_OK,
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
)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    user      = Depends(get_current_user),
):
    """
    Подробный просмотр одного проекта: метаданные + слои.
    """
    project = crud.get_hecras_project(db, project_id, owner_id=user.id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден"
        )
    return project


@router.post(
    "/upload",
    response_model=HecRasSummary,
    status_code=status.HTTP_201_CREATED,
)
def upload_project(
    name: str           = Form(...),
    file: UploadFile    = File(...),
    db: Session         = Depends(get_db),
    user                = Depends(get_current_user),
):
    """
    Загрузка нового .db-файла HEC-RAS:
    — сохраняем файл в ./uploaded_dbs
    — создаём запись в БД через crud.create_hecras_project
    — возвращаем данные проекта (HecRasSummary)
    """
    try:
        upload_dir = "./uploaded_dbs"
        os.makedirs(upload_dir, exist_ok=True)

        file_path = os.path.join(upload_dir, f"{name}.db")
        with open(file_path, "wb") as buffer:
            buffer.write(file.file.read())

        project = crud.create_hecras_project(
            db,
            name=name,
            filepath=file_path,
            owner_id=user.id,
            original_filename=file.filename
        )
        return project

    except Exception as e:
        logging.exception("Ошибка при загрузке проекта")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось загрузить проект: {e}"
        )
