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
    created = Column(DateTime(timezone=True), server_default=func.now())

    # 2. ДОБАВЛЕНА ЭТА СТРОКА ДЛЯ СВЯЗИ С ПРОЕКТАМИ
    projects = relationship("HecRasProject", back_populates="owner")
