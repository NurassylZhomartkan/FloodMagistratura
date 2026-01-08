# backend/database/schemas.py

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

# ——— Пользователи / авторизация ——————————————————————————————————————————

class UserCreate(BaseModel):
    username: str
    email: str # Добавлено поле email для регистрации
    password: str
    language: Optional[str] = 'ru'  # Язык пользователя (ru, en, kz)

class UserLogin(BaseModel):
    username: str
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    avatar_url: Optional[str] = None
    default_map_style: Optional[str] = None
    default_map_projection: Optional[str] = None

    class Config:
        from_attributes = True

class UpdateEmailRequest(BaseModel):
    new_email: str

class RequestEmailChangeRequest(BaseModel):
    new_email: str

class VerifyEmailChangeRequest(BaseModel):
    code: str

class UpdatePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class UpdateMapSettingsRequest(BaseModel):
    map_style: Optional[str] = None
    map_projection: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class MessageResponse(BaseModel):
    message: str


# ——— HEC-RAS проекты ——————————————————————————————————————————————————————

class LayerInfo(BaseModel):
    layerid: str
    time: str
    table: str

    class Config:
        from_attributes = True

class HecRasSummary(BaseModel):
    id: int
    name: str
    created_at: datetime
    original_filename: str
    owner_id: int
    share_hash: Optional[str] = None
    has_password: bool = False  # Показывает, установлен ли пароль для share_hash

    class Config:
        from_attributes = True

class HecRasOut(HecRasSummary):
    """
    Схема для полного вывода данных о проекте.
    Поля metadata и layers сделаны необязательными (Optional),
    чтобы избежать ошибок валидации, если они еще не заполнены.
    """
    # Атрибут в SQLAlchemy-модели: project_metadata.
    # В JSON-ответе будет ключ 'metadata'.
    # Field(...) заменено на default=None, чтобы сделать поле необязательным.
    metadata: Optional[Dict[str, Any]] = Field(default={}, alias='project_metadata')
    
    # Поле layers теперь тоже необязательное и по умолчанию будет пустым списком.
    layers: Optional[List[LayerInfo]] = []

    class Config:
        from_attributes = True
        # Это позволяет Pydantic правильно работать с псевдонимами (alias)
        populate_by_name = True


# ——— Пользовательские слои ————————————————————————————————————————————

class CustomLayerCreate(BaseModel):
    name: str
    geojson_data: Dict[str, Any]  # GeoJSON объект
    fill_color: Optional[str] = None
    line_color: Optional[str] = None

class CustomLayerUpdate(BaseModel):
    name: Optional[str] = None
    geojson_data: Optional[Dict[str, Any]] = None
    fill_color: Optional[str] = None
    line_color: Optional[str] = None

class CustomLayerOut(BaseModel):
    id: int
    name: str
    owner_id: int
    geojson_data: Dict[str, Any]
    fill_color: Optional[str] = None
    line_color: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
