"""
Планировщик автоматического парсинга гидрологических станций.

Каждые 10 минут запускает парсинг сайта http://ecodata.kz:3838/app_dg_map_kz/
и пишет в hydro_stations, hydro_level_observations, hydro_discharge_observations
(UPSERT по station_id + дата наблюдения; хранение с 2020-01-01).

Использует APScheduler (BackgroundScheduler) — работает в отдельном потоке,
не блокируя FastAPI event loop.
"""

import logging
import uuid
import os
from datetime import date, datetime, timedelta
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from database.database import SessionLocal
from database.hydro_allowed_stations import ALLOWED_HYDRO_STATION_IDS
from database.hydro_station_io import upsert_hydro_from_scrape
from database.models.hydro_scrape_run import HydroScrapeRun
from database.models.hydro_station import HydroDischargeObservation, HydroLevelObservation

logger = logging.getLogger(__name__)


def _persist_scrape_run(
    batch_id: str,
    started_at: datetime,
    status: str,
    rows_count: int = 0,
    error_message: Optional[str] = None,
) -> None:
    """Сохраняет запись о прогоне парсера (только БД, без файлов)."""
    db = SessionLocal()
    try:
        msg = (error_message or "")[:8000] or None
        db.add(
            HydroScrapeRun(
                batch_id=batch_id,
                started_at=started_at,
                finished_at=datetime.utcnow(),
                status=status,
                rows_count=rows_count,
                error_message=msg,
            )
        )
        db.commit()
    except Exception as e:
        db.rollback()
        logger.warning("Не удалось записать hydro_scrape_runs: %s", e)
    finally:
        db.close()


def _prune_old_scrape_runs(keep: int = 30) -> None:
    """Оставляет последние `keep` записей журнала."""
    db = SessionLocal()
    try:
        ids = (
            db.query(HydroScrapeRun.id)
            .order_by(HydroScrapeRun.id.desc())
            .offset(keep)
            .all()
        )
        id_list = [i[0] for i in ids]
        if id_list:
            db.query(HydroScrapeRun).filter(HydroScrapeRun.id.in_(id_list)).delete(synchronize_session=False)
            db.commit()
    except Exception as e:
        db.rollback()
        logger.debug("prune hydro_scrape_runs: %s", e)
    finally:
        db.close()

_scheduler: Optional[BackgroundScheduler] = None
_last_run: Optional[datetime] = None
_last_status: str = "never_run"
_last_count: int = 0
_is_running: bool = False
_last_backfill_dates: int = 0


# ── Основная функция парсинга ────────────────────────────────────

def _run_scraping() -> None:
    """Запускается планировщиком каждые 10 минут."""
    global _last_run, _last_status, _last_count, _is_running, _last_backfill_dates

    if _is_running:
        logger.warning("Парсинг уже выполняется, пропускаем запуск.")
        return

    _is_running = True
    started = datetime.utcnow()
    batch_id = str(uuid.uuid4())
    log_status = "error"
    log_count = 0
    log_err: Optional[str] = None

    logger.info("▶ Начало парсинга (batch=%s)", batch_id)

    try:
        # Импортируем парсер (Selenium + Chrome) — только в память, без Excel
        import os as _os
        import sys as _sys

        parsing_dir = _os.path.join(_os.path.dirname(__file__), "..", "parsing")
        parsing_dir = _os.path.abspath(parsing_dir)
        if parsing_dir not in _sys.path:
            _sys.path.insert(0, parsing_dir)

        from data_parsing import scrape

        all_rows: list[dict] = []

        for param in ("level", "discharge"):
            try:
                rows, _ = scrape(param, save_excel=False, allowed_station_ids=ALLOWED_HYDRO_STATION_IDS)
                for r in rows:
                    r["param"] = param
                all_rows.extend(rows)
                logger.info("  param=%s → %d постов (только allowlist)", param, len(rows))
            except Exception as e:
                logger.error("  Ошибка при парсинге param=%s: %s", param, e)

        if not all_rows:
            _last_status = "empty"
            log_status = "empty"
            logger.warning("▶ Парсинг завершён — данные не получены.")
            return

        # UPSERT в БД: обновляем существующие посты, добавляем новые
        db = SessionLocal()
        try:
            now = datetime.utcnow()
            n = upsert_hydro_from_scrape(db, all_rows, batch_id, now)
            _last_count = n
            _last_status = "ok"
            log_status = "ok"
            log_count = n
            logger.info("✅ Синхронизировано %d показаний в БД (batch=%s)", n, batch_id)
            _last_backfill_dates = 0

        except Exception as e:
            db.rollback()
            _last_status = "db_error"
            log_status = "db_error"
            log_err = str(e)
            logger.error("❌ Ошибка сохранения в БД: %s", e)
        finally:
            db.close()

        # Исторический бэкофилл: догружаем пропущенные даты с 2020-01-01.
        # Ограничиваем число дат за прогон, чтобы не блокировать планировщик на часы.
        backfill_limit = int(os.environ.get("HYDRO_BACKFILL_DATES_PER_RUN", "3"))
        if backfill_limit > 0:
            db = SessionLocal()
            try:
                start_date = date(2020, 1, 1)
                today = datetime.utcnow().date()
                existing_level = {
                    d for (d,) in db.query(HydroLevelObservation.observed_on).distinct().all() if d is not None
                }
                existing_discharge = {
                    d for (d,) in db.query(HydroDischargeObservation.observed_on).distinct().all() if d is not None
                }
                existing_dates = existing_level & existing_discharge
                missing_dates: list[date] = []
                cur = start_date
                while cur <= today and len(missing_dates) < backfill_limit:
                    if cur not in existing_dates:
                        missing_dates.append(cur)
                    cur += timedelta(days=1)
            finally:
                db.close()

            if missing_dates:
                logger.info("↺ Backfill дат: %d (лимит %d)", len(missing_dates), backfill_limit)
            for d in missing_dates:
                dtxt = d.isoformat()
                rows_for_day: list[dict] = []
                for param in ("level", "discharge"):
                    try:
                        rows, _ = scrape(
                            param,
                            save_excel=False,
                            allowed_station_ids=ALLOWED_HYDRO_STATION_IDS,
                            observed_on=dtxt,
                        )
                        for r in rows:
                            r["param"] = param
                        rows_for_day.extend(rows)
                    except Exception as e:
                        logger.warning("Backfill %s %s: %s", dtxt, param, e)

                if not rows_for_day:
                    continue

                db = SessionLocal()
                try:
                    b_batch = str(uuid.uuid4())
                    now = datetime.utcnow()
                    nbf = upsert_hydro_from_scrape(db, rows_for_day, b_batch, now)
                    _last_count += nbf
                    _last_backfill_dates += 1
                    logger.info("Backfill %s: сохранено %d строк", dtxt, nbf)
                except Exception as e:
                    db.rollback()
                    logger.warning("Backfill %s save error: %s", dtxt, e)
                finally:
                    db.close()

    except ImportError as e:
        _last_status = "import_error"
        log_status = "import_error"
        log_err = str(e)
        logger.error("❌ Не удалось импортировать парсер: %s", e)
    except Exception as e:
        _last_status = "error"
        log_status = "error"
        log_err = str(e)
        logger.error("❌ Неожиданная ошибка парсинга: %s", e)
    finally:
        _persist_scrape_run(batch_id, started, log_status, log_count, log_err)
        _prune_old_scrape_runs(keep=30)
        _last_run = datetime.utcnow()
        _is_running = False


# ── Публичный API ─────────────────────────────────────────────────

def start_scheduler() -> None:
    """Запускает планировщик. Вызывается при старте FastAPI."""
    global _scheduler

    if os.environ.get("HYDRO_SCHEDULER_DISABLED", "").strip().lower() in ("1", "true", "yes", "on"):
        logger.info("Планировщик гидропарсинга отключён (HYDRO_SCHEDULER_DISABLED).")
        return

    if _scheduler and _scheduler.running:
        logger.info("Планировщик уже запущен.")
        return

    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        _run_scraping,
        trigger=IntervalTrigger(minutes=10),
        id="hydro_scraping",
        name="Парсинг гидростанций ecodata.kz",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=60,
    )
    _scheduler.start()
    logger.info("✅ Планировщик запущен (интервал: 10 мин)")

    # Запускаем первый парсинг немедленно в отдельном потоке
    import threading
    t = threading.Thread(target=_run_scraping, daemon=True, name="hydro-initial-scrape")
    t.start()
    logger.info("▶ Инициирован первый парсинг при старте приложения")


def stop_scheduler() -> None:
    """Останавливает планировщик. Вызывается при завершении FastAPI."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("⛔ Планировщик остановлен")


def trigger_now() -> None:
    """Немедленно запускает парсинг в отдельном потоке."""
    import threading
    t = threading.Thread(target=_run_scraping, daemon=True, name="hydro-manual-scrape")
    t.start()


def get_scheduler_status() -> dict:
    """Возвращает текущий статус планировщика и последнего запуска."""
    global _scheduler, _last_run, _last_status, _last_count, _is_running, _last_backfill_dates

    next_run = None
    if _scheduler and _scheduler.running:
        job = _scheduler.get_job("hydro_scraping")
        if job and job.next_run_time:
            next_run = job.next_run_time.isoformat()

    return {
        "scheduler_running": bool(_scheduler and _scheduler.running),
        "is_scraping":       _is_running,
        "last_run":          _last_run.isoformat() if _last_run else None,
        "last_status":       _last_status,
        "last_count":        _last_count,
        "last_backfill_dates": _last_backfill_dates,
        "next_run":          next_run,
        "interval_minutes":  10,
    }
