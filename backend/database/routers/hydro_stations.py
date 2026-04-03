"""
Роутер для работы с данными гидрологических станций.

Эндпоинты:
  GET /api/hydro-stations/latest         — актуальный снимок (последняя дата по каждому посту: уровень и расход)
  GET /api/hydro-stations/chart-snapshot — уровни для графика
  GET /api/hydro-stations/status         — статус планировщика
  POST /api/hydro-stations/trigger       — ручной запуск парсинга
  GET  /api/hydro-stations/scrape-runs   — журнал hydro_scrape_runs
"""

import logging
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from database.database import get_db
from database.hydro_allowed_stations import ALLOWED_HYDRO_STATION_IDS
from database.hydro_station_io import fetch_latest_readings_for_api, latest_level_rows_subquery
from database.models.hydro_station import HydroDischargeObservation, HydroLevelObservation, HydroStation
from database.models.hydro_scrape_run import HydroScrapeRun

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/hydro-stations", tags=["Hydro Stations"])


@router.get(
    "/latest",
    summary="Последние данные гидростанций",
    description=(
        "Актуальный снимок: по посту — последняя дата наблюдения уровня (таблица hydro_level_observations) "
        "и расхода (hydro_discharge_observations), с 2020 года."
    ),
)
def get_latest_readings(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    return fetch_latest_readings_for_api(db)


@router.get(
    "/all",
    summary="Все данные гидростанций",
    description=(
        "Возвращает все наблюдения уровня (hydro_level_observations) и/или расхода "
        "(hydro_discharge_observations) для allowed гидропостов (без сырых данных raw_data). "
        "Поддерживает фильтры по датам и параметру."
    ),
)
def get_all_observations(
    metric: str = Query("both", pattern="^(level|discharge|both)$"),
    date_from: date | None = Query(None, description="Начальная дата YYYY-MM-DD"),
    date_to: date | None = Query(None, description="Конечная дата YYYY-MM-DD"),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    allowed = ALLOWED_HYDRO_STATION_IDS

    # Объединяем level и discharge в одну запись по (station_id, observed_on),
    # чтобы в таблице в одной строке были оба параметра.
    by_key: dict[tuple[str, date], dict[str, Any]] = {}

    def _ensure_row(station_id: str, observed_on: date, st: HydroStation, default_param: str) -> dict[str, Any]:
        key = (station_id, observed_on)
        row = by_key.get(key)
        if row is not None:
            return row
        merged_param = "both" if metric == "both" else default_param
        row = {
            "id": f"obs:{station_id}:{observed_on.isoformat()}",
            "station_name": st.station_name,
            "station_id": station_id,
            "param": merged_param,
            "date_on_site": observed_on.isoformat() if observed_on else None,
            "actual_level": None,
            "danger_level": None,
            "critical_level": st.critical_level,
            "discharge": None,
            "water_temp": None,
            "status_code": None,
            "color": None,
            "scraped_at": None,
            "_scraped_at_dt": None,  # служебное поле для выбора более свежего scraped_at
        }
        by_key[key] = row
        return row

    def _maybe_update_meta(row: dict[str, Any], obs_scraped_at: Any, water_temp: Any, status_code: Any, color: Any):
        # Если scraped_at свежее — обновляем "мета" поля.
        if obs_scraped_at is None:
            return
        prev_dt = row.get("_scraped_at_dt")
        if prev_dt is None or obs_scraped_at > prev_dt:
            row["_scraped_at_dt"] = obs_scraped_at
            row["water_temp"] = water_temp
            row["status_code"] = status_code
            row["color"] = color
            row["scraped_at"] = obs_scraped_at.isoformat() if obs_scraped_at else None

    if metric in ("level", "both"):
        ql = (
            db.query(HydroLevelObservation, HydroStation)
            .join(HydroStation, HydroStation.station_id == HydroLevelObservation.station_id)
            .filter(HydroLevelObservation.station_id.in_(allowed))
        )
        if date_from:
            ql = ql.filter(HydroLevelObservation.observed_on >= date_from)
        if date_to:
            ql = ql.filter(HydroLevelObservation.observed_on <= date_to)

        for obs, st in ql.all():
            row = _ensure_row(obs.station_id, obs.observed_on, st, default_param="level")
            row["actual_level"] = obs.actual_level
            row["danger_level"] = st.critical_level if st.critical_level is not None else obs.danger_level
            row["critical_level"] = st.critical_level
            _maybe_update_meta(row, obs.scraped_at, obs.water_temp, obs.status_code, obs.color)

    if metric in ("discharge", "both"):
        qd = (
            db.query(HydroDischargeObservation, HydroStation)
            .join(HydroStation, HydroStation.station_id == HydroDischargeObservation.station_id)
            .filter(HydroDischargeObservation.station_id.in_(allowed))
        )
        if date_from:
            qd = qd.filter(HydroDischargeObservation.observed_on >= date_from)
        if date_to:
            qd = qd.filter(HydroDischargeObservation.observed_on <= date_to)

        for obs, st in qd.all():
            row = _ensure_row(obs.station_id, obs.observed_on, st, default_param="discharge")
            row["discharge"] = obs.discharge
            _maybe_update_meta(row, obs.scraped_at, obs.water_temp, obs.status_code, obs.color)

    rows = list(by_key.values())

    def _sort_key(r: dict[str, Any]):
        # Сортируем так, чтобы в таблице строки шли блоками по одной станции.
        sid = str(r.get("station_id") or "")
        d = r.get("date_on_site") or ""
        return (sid, d)

    rows.sort(key=_sort_key)
    for r in rows:
        r.pop("_scraped_at_dt", None)
    return rows


@router.get(
    "/history",
    summary="История по одному гидропосту",
    description=(
        "Временной ряд по station_id: уровень воды (и опасный уровень) и/или расход "
        "за выбранный диапазон дат."
    ),
)
def get_station_history(
    station_id: str = Query(..., description="ID гидропоста"),
    date_from: date | None = Query(None, description="Начальная дата YYYY-MM-DD"),
    date_to: date | None = Query(None, description="Конечная дата YYYY-MM-DD"),
    metric: str = Query("both", pattern="^(level|discharge|both)$"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    sid = station_id.strip()
    if sid not in ALLOWED_HYDRO_STATION_IDS:
        raise HTTPException(status_code=400, detail="station_id_not_allowed")
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=400, detail="invalid_date_range")

    level_rows: list[HydroLevelObservation] = []
    discharge_rows: list[HydroDischargeObservation] = []

    if metric in ("level", "both"):
        ql = (
            db.query(HydroLevelObservation)
            .filter(HydroLevelObservation.station_id == sid)
            .order_by(HydroLevelObservation.observed_on.asc())
        )
        if date_from:
            ql = ql.filter(HydroLevelObservation.observed_on >= date_from)
        if date_to:
            ql = ql.filter(HydroLevelObservation.observed_on <= date_to)
        level_rows = ql.all()

    if metric in ("discharge", "both"):
        qd = (
            db.query(HydroDischargeObservation)
            .filter(HydroDischargeObservation.station_id == sid)
            .order_by(HydroDischargeObservation.observed_on.asc())
        )
        if date_from:
            qd = qd.filter(HydroDischargeObservation.observed_on >= date_from)
        if date_to:
            qd = qd.filter(HydroDischargeObservation.observed_on <= date_to)
        discharge_rows = qd.all()

    station_critical_level = (
        db.query(HydroStation.critical_level)
        .filter(HydroStation.station_id == sid)
        .scalar()
    )

    return {
        "ok": True,
        "station_id": sid,
        "metric": metric,
        "date_from": date_from.isoformat() if date_from else None,
        "date_to": date_to.isoformat() if date_to else None,
        "levels": [
            {
                "date": r.observed_on.isoformat(),
                "actual_level": r.actual_level,
                "danger_level": (
                    station_critical_level
                    if station_critical_level is not None
                    else r.danger_level
                ),
                "critical_level": station_critical_level,
            }
            for r in level_rows
        ],
        "discharges": [
            {
                "date": r.observed_on.isoformat(),
                "discharge": r.discharge,
            }
            for r in discharge_rows
        ],
    }


@router.get(
    "/scrape-runs",
    summary="Журнал прогонов автономного парсера",
    description=(
        "Записи hydro_scrape_runs. При status=ok batch_id совпадает с batch_id в последних наблюдениях."
    ),
)
def list_scrape_runs(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    rows = (
        db.query(HydroScrapeRun)
        .order_by(HydroScrapeRun.id.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "batch_id": r.batch_id,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "status": r.status,
            "rows_count": r.rows_count,
            "error_message": r.error_message,
        }
        for r in rows
    ]


@router.get(
    "/chart-snapshot",
    summary="Снимок уровней для диаграммы",
    description="Последние уровни по постам из hydro_level_observations.",
)
def get_chart_snapshot(
    only_allowlist: bool = Query(True, description="Только посты из белого списка (25 шт.)"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    pairs = latest_level_rows_subquery(db)
    if not pairs:
        return {"ok": False, "error": "no_data", "labels": [], "levels": [], "danger_levels": [], "station_ids": []}

    items: list[tuple[str, str, float | None, float | None]] = []
    updated_ts: float | None = None
    for r, _st in pairs:
        sid = (r.station_id or "").strip()
        if not sid:
            continue
        if only_allowlist and sid not in ALLOWED_HYDRO_STATION_IDS:
            continue
        lv = r.actual_level
        dg = _st.critical_level if _st.critical_level is not None else r.danger_level
        if lv is None and dg is None:
            continue
        name = (_st.station_name or sid)[:48]
        label = f"{sid}: {name}"
        items.append((sid, label, lv, dg))
        if r.scraped_at:
            ts = r.scraped_at.timestamp()
            updated_ts = ts if updated_ts is None else max(updated_ts, ts)

    items.sort(key=lambda x: int(x[0]) if x[0].isdigit() else x[0])

    return {
        "ok": True,
        "labels": [x[1] for x in items],
        "levels": [x[2] for x in items],
        "danger_levels": [x[3] for x in items],
        "station_ids": [x[0] for x in items],
        "source": "hydro_level_observations",
        "updated": updated_ts,
        "only_allowlist": only_allowlist,
    }


@router.get(
    "/status",
    summary="Статус планировщика парсинга",
)
def get_scheduler_status() -> dict:
    from database.scheduler import get_scheduler_status
    return get_scheduler_status()


@router.post(
    "/trigger",
    summary="Запустить парсинг вручную",
    description="Немедленно запускает парсинг в фоне (не ждёт завершения).",
)
def trigger_scraping() -> dict:
    from database.scheduler import trigger_now
    try:
        trigger_now()
        return {"status": "triggered", "message": "Парсинг запущен в фоне"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/import-csv",
    summary="Импорт из stations_all.csv",
    description=(
        "CSV парсера ecodata.kz (lat, lon, station_id, station_name, date, param, …). "
        "UPSERT в hydro_stations, hydro_level_observations, hydro_discharge_observations (дата ≥ 2020-01-01)."
    ),
)
async def import_hydro_csv(file: UploadFile = File(...)) -> dict[str, Any]:
    from database.hydro_station_io import import_hydro_stations_csv_text

    name = (file.filename or "").lower()
    if not name.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Ожидается файл .csv")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Пустой файл")

    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Файл должен быть в UTF-8")

    res = import_hydro_stations_csv_text(text, cleanup_old_batches=True)
    if not res.get("ok"):
        raise HTTPException(
            status_code=400,
            detail=res.get("error") or "import_failed",
        )
    return {
        "status": "ok",
        "imported": res["count"],
        "batch_id": res["batch_id"],
    }
