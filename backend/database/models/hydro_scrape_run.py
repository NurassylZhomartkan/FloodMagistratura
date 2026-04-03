# backend/database/models/hydro_scrape_run.py

"""Журнал автономных прогонов парсера ecodata.kz → таблицы гидронаблюдений."""

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from database.database import Base


class HydroScrapeRun(Base):
    """Один прогон парсера (batch_id в записях hydro_*_observations при успехе)."""

    __tablename__ = "hydro_scrape_runs"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(40), unique=True, nullable=False, index=True)
    started_at = Column(DateTime, nullable=False, index=True)
    finished_at = Column(DateTime, nullable=True)
    # running | ok | empty | db_error | import_error | error
    status = Column(String(32), nullable=False, index=True)
    rows_count = Column(Integer, nullable=False, default=0)
    error_message = Column(Text, nullable=True)
