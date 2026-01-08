# backend/database/models/custom_layer.py

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import relationship
from database.database import Base

class CustomLayer(Base):
    __tablename__ = "custom_layers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    geojson_data = Column(Text, nullable=False)  # Храним GeoJSON как текст
    fill_color = Column(String(7))  # HEX цвет для заливки
    line_color = Column(String(7))  # HEX цвет для линий
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Связь с пользователем
    owner = relationship("User", back_populates="custom_layers")
















