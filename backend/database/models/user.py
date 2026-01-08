# backend/database/models/user.py

from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from sqlalchemy.orm import relationship  # 1. ДОБАВЛЕН ЭТОТ ИМПОРТ
from database.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    email = Column(String(256), unique=True, index=True, nullable=False)
    password = Column(String(128), nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String(256), nullable=True, index=True)
    reset_token = Column(String(256), nullable=True, index=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable=True)
    avatar_url = Column(String(512), nullable=True)
    created = Column(DateTime(timezone=True), server_default=func.now())
    # Поля для изменения email с подтверждением
    pending_email = Column(String(256), nullable=True)
    email_change_code = Column(String(10), nullable=True, index=True)
    email_change_code_expires = Column(DateTime(timezone=True), nullable=True)
    # Язык пользователя для email уведомлений
    language = Column(String(10), default='ru', nullable=False)
    # Настройки карты
    default_map_style = Column(String(50), nullable=True)  # Стиль карты по умолчанию
    default_map_projection = Column(String(50), nullable=True)  # Проекция карты по умолчанию

    # 2. ДОБАВЛЕНА ЭТА СТРОКА ДЛЯ СВЯЗИ С ПРОЕКТАМИ
    projects = relationship("HecRasProject", back_populates="owner")
    # Связь с пользовательскими слоями
    custom_layers = relationship("CustomLayer", back_populates="owner")
    # Связь с flood проектами
    flood_projects = relationship("FloodProject", back_populates="owner")
