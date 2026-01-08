# backend/database/routers/custom_layers.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import json

from database.database import get_db
from database import crud
from database.schemas import CustomLayerCreate, CustomLayerUpdate, CustomLayerOut
from database.routers.auth import get_current_user
from database.models.user import User

router = APIRouter(prefix="/api/custom-layers", tags=["Custom Layers"])

@router.post(
    "/",
    response_model=CustomLayerOut,
    status_code=status.HTTP_201_CREATED,
    summary="Создать пользовательский слой",
    description="Создает новый пользовательский слой с GeoJSON данными. Слой может содержать точки, линии или полигоны. Поддерживает настройку цветов заливки и границ для визуализации на карте."
)
def create_custom_layer(
    layer: CustomLayerCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Создаёт новый пользовательский слой.
    """
    # Преобразуем GeoJSON в строку для хранения в БД
    geojson_str = json.dumps(layer.geojson_data)
    
    try:
        db_layer = crud.create_custom_layer(
            db=db,
            name=layer.name,
            owner_id=user.id,
            geojson_data=geojson_str,
            fill_color=layer.fill_color,
            line_color=layer.line_color
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    # Преобразуем обратно в JSON для ответа
    db_layer.geojson_data = json.loads(db_layer.geojson_data)
    return db_layer

@router.get(
    "/",
    response_model=list[CustomLayerOut],
    summary="Список пользовательских слоев",
    description="Возвращает все пользовательские слои текущего авторизованного пользователя. Каждый слой содержит GeoJSON данные, имя, цвета заливки и границ."
)
def list_custom_layers(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Возвращает все пользовательские слои текущего пользователя.
    """
    layers = crud.list_custom_layers(db, owner_id=user.id)
    
    # Преобразуем geojson_data из строки в JSON для каждого слоя
    for layer in layers:
        layer.geojson_data = json.loads(layer.geojson_data)
    
    return layers

@router.get(
    "/{layer_id}",
    response_model=CustomLayerOut,
    summary="Получить пользовательский слой",
    description="Возвращает один пользовательский слой по ID. Включает полные GeoJSON данные, имя и настройки цветов."
)
def get_custom_layer(
    layer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Возвращает один пользовательский слой по ID.
    """
    layer = crud.get_custom_layer(db, layer_id=layer_id, owner_id=user.id)
    if not layer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Layer not found"
        )
    
    # Преобразуем geojson_data из строки в JSON
    layer.geojson_data = json.loads(layer.geojson_data)
    return layer

@router.put(
    "/{layer_id}",
    response_model=CustomLayerOut,
    summary="Обновить пользовательский слой",
    description="Обновляет пользовательский слой по ID. Можно обновить имя, GeoJSON данные, цвета заливки и границ. Все поля опциональны - обновляются только переданные значения."
)
def update_custom_layer(
    layer_id: int,
    layer_update: CustomLayerUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Обновляет пользовательский слой по ID.
    """
    # Преобразуем GeoJSON в строку для хранения в БД, если он предоставлен
    geojson_str = None
    if layer_update.geojson_data is not None:
        geojson_str = json.dumps(layer_update.geojson_data)
    
    updated_layer = crud.update_custom_layer(
        db=db,
        layer_id=layer_id,
        owner_id=user.id,
        name=layer_update.name,
        geojson_data=geojson_str,
        fill_color=layer_update.fill_color,
        line_color=layer_update.line_color
    )
    if not updated_layer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Layer not found"
        )
    
    # Преобразуем geojson_data из строки в JSON
    updated_layer.geojson_data = json.loads(updated_layer.geojson_data)
    return updated_layer

@router.delete(
    "/{layer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удалить пользовательский слой",
    description="Удаляет пользовательский слой по ID. Операция необратима. Удаляет только слои, принадлежащие текущему пользователю."
)
def delete_custom_layer(
    layer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Удаляет пользовательский слой по ID.
    """
    success = crud.delete_custom_layer(db, layer_id=layer_id, owner_id=user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Layer not found"
        )
    return None








