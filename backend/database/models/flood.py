# backend/database/models/flood.py

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database.database import Base

class FloodProject(Base):
    __tablename__ = 'flood_projects'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)
    owner_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    share_hash = Column(String, unique=True, nullable=True, index=True)
    simulation_data = Column(JSON, nullable=True)  # Параметры симуляции
    files_data = Column(JSON, nullable=True)  # Метаданные о файлах проекта

    owner = relationship("User", back_populates="flood_projects")










