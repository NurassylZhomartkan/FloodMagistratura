# backend/database/models/hec_ras.py

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database.database import Base

class HecRasProject(Base):
    __tablename__ = 'hecras_projects'

    id                = Column(Integer, primary_key=True, index=True)
    name              = Column(String, index=True)
    filepath          = Column(String, unique=True, nullable=False)
    original_filename = Column(String, nullable=False)
    owner_id          = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at        = Column(DateTime, default=datetime.utcnow)
    # Переименовали атрибут, но сохранили имя колонки:
    project_metadata  = Column('metadata', JSON, nullable=True)
    layers            = Column(JSON, nullable=True)

    owner = relationship("User", back_populates="projects")
