# backend/database/models/hydro_station.py

from datetime import datetime

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    UniqueConstraint,
)

from database.database import Base

# Нижняя граница хранимых наблюдений (включительно)
HYDRO_OBSERVATIONS_MIN_DATE = datetime(2020, 1, 1).date()


class HydroStation(Base):
    """Справочник постов: одна строка на station_id, координаты и имя обновляются при парсинге."""

    __tablename__ = "hydro_stations"

    station_id = Column(String(64), primary_key=True, index=True)
    station_name = Column(String(512), nullable=True)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
    # Постоянный порог опасного уровня для поста (задаётся вручную/из справочника).
    critical_level = Column(Float, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, index=True)


class HydroLevelObservation(Base):
    """Уровень воды по посту на дату наблюдения (с сайта)."""

    __tablename__ = "hydro_level_observations"
    __table_args__ = (
        UniqueConstraint("station_id", "observed_on", name="uq_hydro_level_station_date"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    station_id = Column(String(64), ForeignKey("hydro_stations.station_id", ondelete="CASCADE"), nullable=False, index=True)
    observed_on = Column(Date, nullable=False, index=True)

    batch_id = Column(String(64), nullable=True, index=True)
    actual_level = Column(Float, nullable=True)
    danger_level = Column(Float, nullable=True)
    water_temp = Column(Float, nullable=True)
    status_code = Column(String(64), nullable=True)
    color = Column(String(32), nullable=True)
    raw_data = Column(JSON, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class HydroDischargeObservation(Base):
    """Расход воды по посту на дату наблюдения."""

    __tablename__ = "hydro_discharge_observations"
    __table_args__ = (
        UniqueConstraint("station_id", "observed_on", name="uq_hydro_discharge_station_date"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    station_id = Column(String(64), ForeignKey("hydro_stations.station_id", ondelete="CASCADE"), nullable=False, index=True)
    observed_on = Column(Date, nullable=False, index=True)

    batch_id = Column(String(64), nullable=True, index=True)
    discharge = Column(Float, nullable=True)
    water_temp = Column(Float, nullable=True)
    status_code = Column(String(64), nullable=True)
    color = Column(String(32), nullable=True)
    raw_data = Column(JSON, nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
