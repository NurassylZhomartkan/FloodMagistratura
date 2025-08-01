# backend/database/schemas.py

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

# ——— Пользователи / авторизация ——————————————————————————————————————————

class UserCreate(BaseModel):
    username: str
    email: str # Добавлено поле email для регистрации
    password: str

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

    class Config:
        from_attributes = True


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
