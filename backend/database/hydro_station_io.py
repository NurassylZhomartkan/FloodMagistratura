"""
Импорт и UPSERT гидроданных ecodata.kz.

Схема:
  hydro_stations — справочник постов;
  hydro_level_observations — уровни (уникально station_id + observed_on);
  hydro_discharge_observations — расходы (уникально station_id + observed_on).

Храним только наблюдения с observed_on >= 2020-01-01. История за прошлые годы
накапливается при регулярном парсинге (каждый день — новая дата на сайте).

Только 25 гидропостов из списка приложения (database.hydro_allowed_stations); остальные
не импортируются и удаляются из БД при старте (purge_hydro_outside_allowlist).
"""

from __future__ import annotations

import csv
import io
import json
import logging
import os
import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from database.database import SessionLocal, engine
from database.hydro_allowed_stations import (
    ALLOWED_HYDRO_STATION_IDS,
    filter_rows_to_allowed_hydro_stations,
)
from database.models.hydro_station import (
    HYDRO_OBSERVATIONS_MIN_DATE,
    HydroDischargeObservation,
    HydroLevelObservation,
    HydroStation,
)

_ALLOWED_IDS_SQL = tuple(ALLOWED_HYDRO_STATION_IDS)

logger = logging.getLogger(__name__)

LEVEL_KEYS: dict[str, list[str]] = {
    "actual_level": [
        "Нақты деңгей, см",
        "Фактический уровень",
        "Уровень",
        "Уровень воды",
        "Нақты деңгей",
        "Деңгей",
    ],
    "danger_level": [
        "Қауіпті деңгей, см",
        "Опасный уровень",
        "Критический уровень",
        "Қауіпті деңгей",
    ],
    "discharge": [
        "Нақты шығын, м³/с",
        "Расход воды",
        "Расход",
        "Су шығыны",
        "Шығын",
    ],
    "water_temp": [
        "Судың температурасы,°C",
        "Температура воды",
        "Температура",
        "Су температурасы",
    ],
    "status_code": [
        "Су объектінің күй коды",
        "Код",
        "Код состояния",
        "Состояние",
        "Код күйі",
        "Күй",
    ],
}

_ROW_META = frozenset({"lat", "lon", "station_id", "color", "param", "station_name", "date"})


def extract_fields(raw: dict) -> dict[str, Any | None]:
    result: dict[str, Any | None] = {}
    for field, candidates in LEVEL_KEYS.items():
        val = None
        for key in candidates:
            if key in raw and raw[key] not in (None, ""):
                val = raw[key]
                break
        if val is None and field in raw and raw[field] not in (None, ""):
            val = raw[field]
        result[field] = val
    return result


def _norm_station_id(val: Any) -> str:
    if val is None or (isinstance(val, str) and not val.strip()):
        return ""
    s = str(val).strip()
    try:
        return str(int(float(s.replace(",", "."))))
    except (ValueError, TypeError):
        return s


def _parse_float(val: Any) -> float | None:
    if val is None or val == "":
        return None
    t = str(val).strip().replace("\xa0", "").replace(" ", "").replace(",", ".")
    if not t or t.upper() in ("NA", "N/A", "—", "-", "NONE", "NULL", "NAN"):
        return None
    try:
        return float(t)
    except ValueError:
        return None


def _parse_observed_on(s: str | None) -> date | None:
    if not s or not str(s).strip():
        return None
    t = str(s).strip()[:10]
    try:
        y, m, d = int(t[0:4]), int(t[5:7]), int(t[8:10])
        return date(y, m, d)
    except (ValueError, IndexError):
        return None


def _fmt_num_for_api(v: float | None) -> str | None:
    if v is None:
        return None
    if abs(v - round(v)) < 1e-9:
        return str(int(round(v)))
    return str(v)


def csv_dict_to_row(d: dict[str, str]) -> dict[str, Any] | None:
    param = (d.get("param") or "").strip()
    if param not in ("level", "discharge"):
        return None
    sid = _norm_station_id(d.get("station_id"))
    if not sid:
        return None
    row: dict[str, Any] = {
        "lat": _parse_float(d.get("lat")),
        "lon": _parse_float(d.get("lon")),
        "station_id": sid,
        "color": (d.get("color") or "").strip() or None,
        "station_name": (d.get("station_name") or "").strip() or None,
        "date": (d.get("date") or "").strip() or None,
        "param": param,
    }
    for k, v in d.items():
        if k in _ROW_META:
            continue
        if v is None or (isinstance(v, str) and not v.strip()):
            continue
        row[k] = v.strip() if isinstance(v, str) else v
    return row


def _dedupe_rows_by_station_param_date(all_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Удаляет только точные дубли в рамках (station_id, param, observed_on).
    Историю по разным датам сохраняем.
    """
    by_key: dict[tuple[str, str, date], dict[str, Any]] = {}
    for row in all_rows:
        sid = str(row.get("station_id") or "").strip()
        p = row.get("param")
        obs_on = _parse_observed_on(row.get("date"))
        if not sid or p not in ("level", "discharge") or obs_on is None:
            continue
        by_key[(sid, str(p), obs_on)] = row
    return list(by_key.values())


def _registry_from_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    for row in rows:
        sid = str(row.get("station_id") or "").strip()
        if not sid:
            continue
        by_id[sid] = {
            "station_id": sid,
            "station_name": row.get("station_name") or "",
            "lat": row.get("lat"),
            "lon": row.get("lon"),
            "updated_at": datetime.utcnow(),
        }
    return list(by_id.values())


def _build_level_discharge_mappings(
    all_rows: list[dict[str, Any]],
    batch_id: str,
    now: datetime,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    rows = _dedupe_rows_by_station_param_date(all_rows)
    # Сначала level, потом discharge — чтобы расход с отдельного снимка карты перезаписал значение из popup уровня
    rows.sort(key=lambda r: (0 if r.get("param") == "level" else 1))

    level_by_key: dict[tuple[str, date], dict[str, Any]] = {}
    discharge_by_key: dict[tuple[str, date], dict[str, Any]] = {}

    def put_level(sid: str, obs_on: date, row: dict, raw: dict, fields: dict) -> None:
        key = (sid, obs_on)
        if key in level_by_key:
            return
        level_by_key[key] = {
            "station_id": sid,
            "observed_on": obs_on,
            "batch_id": batch_id,
            "actual_level": _parse_float(fields.get("actual_level")),
            "danger_level": _parse_float(fields.get("danger_level")),
            "water_temp": _parse_float(fields.get("water_temp")),
            "status_code": (
                str(fields["status_code"]).strip()[:64]
                if fields.get("status_code") not in (None, "")
                else None
            ),
            "color": row.get("color"),
            "raw_data": raw,
            "scraped_at": now,
        }

    def put_discharge(sid: str, obs_on: date, row: dict, raw: dict, fields: dict) -> None:
        q = _parse_float(fields.get("discharge"))
        if q is None:
            return
        key = (sid, obs_on)
        discharge_by_key[key] = {
            "station_id": sid,
            "observed_on": obs_on,
            "batch_id": batch_id,
            "discharge": q,
            "water_temp": _parse_float(fields.get("water_temp")),
            "status_code": (
                str(fields["status_code"]).strip()[:64]
                if fields.get("status_code") not in (None, "")
                else None
            ),
            "color": row.get("color"),
            "raw_data": raw,
            "scraped_at": now,
        }

    for row in rows:
        sid = str(row.get("station_id") or "").strip()
        param = row.get("param")
        obs_on = _parse_observed_on(row.get("date"))
        if not sid or obs_on is None or obs_on < HYDRO_OBSERVATIONS_MIN_DATE:
            continue
        raw = {k: v for k, v in row.items() if k not in _ROW_META}
        fields = extract_fields(raw)

        if param == "level":
            put_level(sid, obs_on, row, raw, fields)
            put_discharge(sid, obs_on, row, raw, fields)
        elif param == "discharge":
            put_discharge(sid, obs_on, row, raw, fields)
            if fields.get("actual_level") is not None or fields.get("danger_level") is not None:
                put_level(sid, obs_on, row, raw, fields)

    return list(level_by_key.values()), list(discharge_by_key.values())


def upsert_hydro_stations_registry(db: Session, registry: list[dict[str, Any]]) -> int:
    if not registry:
        return 0
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as pg_insert

        t = HydroStation.__table__
        stmt = pg_insert(t).values(registry)
        ex = stmt.excluded
        stmt = stmt.on_conflict_do_update(
            index_elements=[t.c.station_id],
            set_={
                "station_name": ex.station_name,
                "lat": ex.lat,
                "lon": ex.lon,
                "updated_at": ex.updated_at,
            },
        )
        db.execute(stmt)
        return len(registry)

    for m in registry:
        sid = m["station_id"]
        row = db.get(HydroStation, sid)
        if row:
            row.station_name = m.get("station_name") or row.station_name
            row.lat = m.get("lat") if m.get("lat") is not None else row.lat
            row.lon = m.get("lon") if m.get("lon") is not None else row.lon
            row.updated_at = m["updated_at"]
        else:
            db.add(HydroStation(**m))
    return len(registry)


def _bulk_upsert_level(db: Session, mappings: list[dict[str, Any]]) -> None:
    if not mappings:
        return
    dialect = db.get_bind().dialect.name
    table = HydroLevelObservation.__table__
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as pg_insert

        stmt = pg_insert(table).values(mappings)
        ex = stmt.excluded
        stmt = stmt.on_conflict_do_update(
            constraint="uq_hydro_level_station_date",
            set_={
                "batch_id": ex.batch_id,
                "actual_level": ex.actual_level,
                "danger_level": ex.danger_level,
                "water_temp": ex.water_temp,
                "status_code": ex.status_code,
                "color": ex.color,
                "raw_data": ex.raw_data,
                "scraped_at": ex.scraped_at,
            },
        )
        db.execute(stmt)
        return

    from sqlalchemy.dialects.sqlite import insert as sqlite_insert

    stmt = sqlite_insert(table).values(mappings)
    ex = stmt.excluded
    stmt = stmt.on_conflict_do_update(
        index_elements=[table.c.station_id, table.c.observed_on],
        set_={
            "batch_id": ex.batch_id,
            "actual_level": ex.actual_level,
            "danger_level": ex.danger_level,
            "water_temp": ex.water_temp,
            "status_code": ex.status_code,
            "color": ex.color,
            "raw_data": ex.raw_data,
            "scraped_at": ex.scraped_at,
        },
    )
    db.execute(stmt)


def _bulk_upsert_discharge(db: Session, mappings: list[dict[str, Any]]) -> None:
    if not mappings:
        return
    dialect = db.get_bind().dialect.name
    table = HydroDischargeObservation.__table__
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as pg_insert

        stmt = pg_insert(table).values(mappings)
        ex = stmt.excluded
        stmt = stmt.on_conflict_do_update(
            constraint="uq_hydro_discharge_station_date",
            set_={
                "batch_id": ex.batch_id,
                "discharge": ex.discharge,
                "water_temp": ex.water_temp,
                "status_code": ex.status_code,
                "color": ex.color,
                "raw_data": ex.raw_data,
                "scraped_at": ex.scraped_at,
            },
        )
        db.execute(stmt)
        return

    from sqlalchemy.dialects.sqlite import insert as sqlite_insert

    stmt = sqlite_insert(table).values(mappings)
    ex = stmt.excluded
    stmt = stmt.on_conflict_do_update(
        index_elements=[table.c.station_id, table.c.observed_on],
        set_={
            "batch_id": ex.batch_id,
            "discharge": ex.discharge,
            "water_temp": ex.water_temp,
            "status_code": ex.status_code,
            "color": ex.color,
            "raw_data": ex.raw_data,
            "scraped_at": ex.scraped_at,
        },
    )
    db.execute(stmt)


def upsert_hydro_from_scrape(
    db: Session,
    all_rows: list[dict[str, Any]],
    batch_id: str,
    now: datetime,
) -> int:
    """
    Реестр постов + UPSERT наблюдений уровня и расхода.
    Возвращает число новых/обновлённых строк (уровни + расходы).
    """
    all_rows = filter_rows_to_allowed_hydro_stations(all_rows)
    level_maps, discharge_maps = _build_level_discharge_mappings(all_rows, batch_id, now)
    by_id: dict[str, dict[str, Any]] = {r["station_id"]: r for r in _registry_from_rows(all_rows)}
    for m in level_maps + discharge_maps:
        sid = m["station_id"]
        if sid not in by_id:
            by_id[sid] = {
                "station_id": sid,
                "station_name": "",
                "lat": None,
                "lon": None,
                "updated_at": now,
            }
    registry = list(by_id.values())

    upsert_hydro_stations_registry(db, registry)
    _bulk_upsert_level(db, level_maps)
    _bulk_upsert_discharge(db, discharge_maps)
    db.commit()
    return len(level_maps) + len(discharge_maps)


def prune_observations_before_min_date(db: Session) -> tuple[int, int]:
    """Удаляет наблюдения раньше 2020-01-01 (идемпотентно)."""
    n1 = (
        db.query(HydroLevelObservation)
        .filter(HydroLevelObservation.observed_on < HYDRO_OBSERVATIONS_MIN_DATE)
        .delete(synchronize_session=False)
    )
    n2 = (
        db.query(HydroDischargeObservation)
        .filter(HydroDischargeObservation.observed_on < HYDRO_OBSERVATIONS_MIN_DATE)
        .delete(synchronize_session=False)
    )
    db.commit()
    return n1, n2


def purge_hydro_outside_allowlist(db: Session) -> dict[str, int]:
    """Удаляет посты и наблюдения не из ALLOWED_HYDRO_STATION_IDS (25 постов карты приложения)."""
    n_level = (
        db.query(HydroLevelObservation)
        .filter(~HydroLevelObservation.station_id.in_(_ALLOWED_IDS_SQL))
        .delete(synchronize_session=False)
    )
    n_dis = (
        db.query(HydroDischargeObservation)
        .filter(~HydroDischargeObservation.station_id.in_(_ALLOWED_IDS_SQL))
        .delete(synchronize_session=False)
    )
    n_st = (
        db.query(HydroStation)
        .filter(~HydroStation.station_id.in_(_ALLOWED_IDS_SQL))
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"level_rows": n_level, "discharge_rows": n_dis, "station_rows": n_st}


def ensure_hydro_observations_schema() -> None:
    """PostgreSQL: дубликаты по UNIQUE и при необходимости создание ограничений."""
    if engine.dialect.name != "postgresql":
        return
    try:
        with engine.begin() as conn:
            for table, constraint, cols in (
                ("hydro_level_observations", "uq_hydro_level_station_date", "station_id, observed_on"),
                ("hydro_discharge_observations", "uq_hydro_discharge_station_date", "station_id, observed_on"),
            ):
                conn.execute(
                    text(
                        f"""
                        DELETE FROM {table} WHERE id IN (
                          SELECT id FROM (
                            SELECT id,
                              ROW_NUMBER() OVER (
                                PARTITION BY {cols}
                                ORDER BY scraped_at DESC NULLS LAST, id DESC
                              ) AS rn
                            FROM {table}
                          ) sub WHERE sub.rn > 1
                        )
                        """
                    )
                )
                chk = conn.execute(
                    text(
                        f"""
                        SELECT 1 FROM pg_constraint c
                        JOIN pg_class t ON c.conrelid = t.oid
                        WHERE t.relname = :tname AND c.conname = :cname
                        LIMIT 1
                        """
                    ),
                    {"tname": table, "cname": constraint},
                )
                if chk.fetchone() is None:
                    conn.execute(
                        text(
                            f"ALTER TABLE {table} ADD CONSTRAINT {constraint} "
                            f"UNIQUE ({cols})"
                        )
                    )
        logger.info("hydro observations: PostgreSQL UNIQUE проверены")
    except Exception as e:
        logger.warning("ensure_hydro_observations_schema: %s", e)


def ensure_hydro_stations_schema() -> None:
    """Добавляет служебные колонки справочника hydro_stations при необходимости."""
    try:
        with engine.begin() as conn:
            dialect = engine.dialect.name
            if dialect == "postgresql":
                conn.execute(
                    text(
                        """
                        ALTER TABLE hydro_stations
                        ADD COLUMN IF NOT EXISTS critical_level DOUBLE PRECISION
                        """
                    )
                )
            elif dialect == "sqlite":
                cols = {
                    str(r[1]).lower()
                    for r in conn.execute(text("PRAGMA table_info(hydro_stations)")).fetchall()
                }
                if "critical_level" not in cols:
                    conn.execute(text("ALTER TABLE hydro_stations ADD COLUMN critical_level REAL"))
    except Exception as e:
        logger.warning("ensure_hydro_stations_schema: %s", e)


def migrate_legacy_hydro_station_readings_if_needed() -> int:
    """
    Однократный перенос из hydro_station_readings (старая схема), если новые таблицы пусты.
    """
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    if "hydro_station_readings" not in tables:
        return 0

    db = SessionLocal()
    migrated = 0
    try:
        n_level = db.query(HydroLevelObservation).count()
        n_dis = db.query(HydroDischargeObservation).count()
        if n_level + n_dis > 0:
            return 0

        rows = db.execute(
            text(
                "SELECT station_id, station_name, lat, lon, param, date_on_site, "
                "actual_level, danger_level, discharge, water_temp, status_code, color, raw_data, batch_id, scraped_at "
                "FROM hydro_station_readings"
            )
        ).mappings().all()
        if not rows:
            return 0

        synthetic: list[dict[str, Any]] = []
        for r in rows:
            sid = _norm_station_id(r.get("station_id"))
            if not sid:
                continue
            p = (r.get("param") or "").strip()
            if p not in ("level", "discharge"):
                continue
            d = r.get("date_on_site")
            obs = _parse_observed_on(str(d) if d else None)
            if obs is None or obs < HYDRO_OBSERVATIONS_MIN_DATE:
                continue

            raw = r.get("raw_data")
            if isinstance(raw, str):
                try:
                    raw = json.loads(raw)
                except json.JSONDecodeError:
                    raw = {}
            if not isinstance(raw, dict):
                raw = {}

            lat = float(r["lat"]) if r.get("lat") is not None else None
            lon = float(r["lon"]) if r.get("lon") is not None else None
            synthetic.append(
                {
                    "station_id": sid,
                    "station_name": r.get("station_name"),
                    "lat": lat,
                    "lon": lon,
                    "date": str(obs),
                    "param": p,
                    "color": r.get("color"),
                    **{k: v for k, v in raw.items() if k not in _ROW_META},
                }
            )
            fields = {
                "actual_level": r.get("actual_level"),
                "danger_level": r.get("danger_level"),
                "discharge": r.get("discharge"),
                "water_temp": r.get("water_temp"),
                "status_code": r.get("status_code"),
            }
            for fk, fv in fields.items():
                if fv is not None and str(fv).strip():
                    if fk not in synthetic[-1]:
                        synthetic[-1][fk] = fv

        batch_id = str(uuid.uuid4())
        now = datetime.utcnow()
        migrated = upsert_hydro_from_scrape(db, synthetic, batch_id, now)
        logger.info("Миграция hydro_station_readings → новые таблицы: %s строк", migrated)
        return migrated
    except Exception as e:
        db.rollback()
        logger.warning("migrate_legacy_hydro_station_readings_if_needed: %s", e)
        return 0
    finally:
        db.close()


def import_hydro_stations_csv_text(text: str, cleanup_old_batches: bool = True) -> dict[str, Any]:
    _ = cleanup_old_batches
    f = io.StringIO(text)
    reader = csv.DictReader(f)
    if not reader.fieldnames:
        return {"ok": False, "count": 0, "error": "empty_csv"}

    rows: list[dict[str, Any]] = []
    for d in reader:
        if not d:
            continue
        r = csv_dict_to_row({k: (v or "") for k, v in d.items()})
        if r:
            rows.append(r)

    rows = filter_rows_to_allowed_hydro_stations(rows)

    if not rows:
        return {"ok": False, "count": 0, "error": "no_valid_rows"}

    batch_id = str(uuid.uuid4())
    now = datetime.utcnow()

    db = SessionLocal()
    try:
        n = upsert_hydro_from_scrape(db, rows, batch_id, now)
        return {"ok": True, "count": n, "batch_id": batch_id}
    except Exception as e:
        db.rollback()
        logger.exception("import_hydro_stations_csv_text")
        return {"ok": False, "count": 0, "error": str(e)}
    finally:
        db.close()


def import_hydro_stations_csv_path(path: str, cleanup_old_batches: bool = True) -> dict[str, Any]:
    with open(path, encoding="utf-8-sig", newline="") as fp:
        return import_hydro_stations_csv_text(fp.read(), cleanup_old_batches=cleanup_old_batches)


def bootstrap_hydro_csv_if_database_empty() -> None:
    if os.environ.get("HYDRO_DISABLE_CSV_BOOTSTRAP", "").lower() in ("1", "true", "yes"):
        return

    path = (os.environ.get("HYDRO_BOOTSTRAP_CSV") or "").strip()
    if not path:
        path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "parsing", "output", "stations_all.csv")
        )

    if not os.path.isfile(path):
        logger.debug("Hydro CSV bootstrap: нет файла %s", path)
        return

    db = SessionLocal()
    try:
        if db.query(HydroLevelObservation).count() + db.query(HydroDischargeObservation).count() > 0:
            return
    finally:
        db.close()

    try:
        res = import_hydro_stations_csv_path(path)
        if res.get("ok"):
            logger.info("Hydro CSV bootstrap: импортировано %s записей из %s", res.get("count"), path)
        else:
            logger.warning("Hydro CSV bootstrap: не удалось — %s", res.get("error"))
    except Exception as e:
        logger.warning("Hydro CSV bootstrap: ошибка %s", e)


def latest_level_rows_subquery(db: Session):
    """Последнее наблюдение уровня на пост (по дате, затем по scraped_at)."""
    from sqlalchemy import func

    sub = (
        db.query(
            HydroLevelObservation.station_id.label("sid"),
            func.max(HydroLevelObservation.observed_on).label("max_d"),
        )
        .filter(HydroLevelObservation.station_id.in_(_ALLOWED_IDS_SQL))
        .group_by(HydroLevelObservation.station_id)
        .subquery()
    )
    inner = (
        db.query(
            HydroLevelObservation.station_id,
            HydroLevelObservation.observed_on,
            func.max(HydroLevelObservation.scraped_at).label("max_s"),
        )
        .join(
            sub,
            (HydroLevelObservation.station_id == sub.c.sid)
            & (HydroLevelObservation.observed_on == sub.c.max_d),
        )
        .group_by(
            HydroLevelObservation.station_id,
            HydroLevelObservation.observed_on,
        )
        .subquery()
    )
    return (
        db.query(HydroLevelObservation, HydroStation)
        .join(
            inner,
            (HydroLevelObservation.station_id == inner.c.station_id)
            & (HydroLevelObservation.observed_on == inner.c.observed_on)
            & (HydroLevelObservation.scraped_at == inner.c.max_s),
        )
        .join(HydroStation, HydroStation.station_id == HydroLevelObservation.station_id)
        .filter(HydroLevelObservation.station_id.in_(_ALLOWED_IDS_SQL))
        .all()
    )


def latest_discharge_rows_subquery(db: Session):
    from sqlalchemy import func

    sub = (
        db.query(
            HydroDischargeObservation.station_id.label("sid"),
            func.max(HydroDischargeObservation.observed_on).label("max_d"),
        )
        .filter(HydroDischargeObservation.station_id.in_(_ALLOWED_IDS_SQL))
        .group_by(HydroDischargeObservation.station_id)
        .subquery()
    )
    inner = (
        db.query(
            HydroDischargeObservation.station_id,
            HydroDischargeObservation.observed_on,
            func.max(HydroDischargeObservation.scraped_at).label("max_s"),
        )
        .join(
            sub,
            (HydroDischargeObservation.station_id == sub.c.sid)
            & (HydroDischargeObservation.observed_on == sub.c.max_d),
        )
        .group_by(
            HydroDischargeObservation.station_id,
            HydroDischargeObservation.observed_on,
        )
        .subquery()
    )
    return (
        db.query(HydroDischargeObservation, HydroStation)
        .join(
            inner,
            (HydroDischargeObservation.station_id == inner.c.station_id)
            & (HydroDischargeObservation.observed_on == inner.c.observed_on)
            & (HydroDischargeObservation.scraped_at == inner.c.max_s),
        )
        .join(HydroStation, HydroStation.station_id == HydroDischargeObservation.station_id)
        .filter(HydroDischargeObservation.station_id.in_(_ALLOWED_IDS_SQL))
        .all()
    )


def level_row_to_api_dict(obs: HydroLevelObservation, st: HydroStation) -> dict[str, Any]:
    danger_level = st.critical_level if st.critical_level is not None else obs.danger_level
    return {
        "id": obs.id,
        "batch_id": obs.batch_id,
        "station_name": st.station_name,
        "station_id": obs.station_id,
        "lat": st.lat,
        "lon": st.lon,
        "param": "level",
        "date_on_site": obs.observed_on.isoformat() if obs.observed_on else None,
        "actual_level": _fmt_num_for_api(obs.actual_level),
        "danger_level": _fmt_num_for_api(danger_level),
        "critical_level": _fmt_num_for_api(st.critical_level),
        "discharge": None,
        "water_temp": _fmt_num_for_api(obs.water_temp),
        "status_code": obs.status_code,
        "color": obs.color,
        "raw_data": obs.raw_data,
        "scraped_at": obs.scraped_at.isoformat() if obs.scraped_at else None,
    }


def discharge_row_to_api_dict(obs: HydroDischargeObservation, st: HydroStation) -> dict[str, Any]:
    return {
        "id": obs.id,
        "batch_id": obs.batch_id,
        "station_name": st.station_name,
        "station_id": obs.station_id,
        "lat": st.lat,
        "lon": st.lon,
        "param": "discharge",
        "date_on_site": obs.observed_on.isoformat() if obs.observed_on else None,
        "actual_level": None,
        "danger_level": None,
        "critical_level": _fmt_num_for_api(st.critical_level),
        "discharge": _fmt_num_for_api(obs.discharge),
        "water_temp": _fmt_num_for_api(obs.water_temp),
        "status_code": obs.status_code,
        "color": obs.color,
        "raw_data": obs.raw_data,
        "scraped_at": obs.scraped_at.isoformat() if obs.scraped_at else None,
    }


def fetch_latest_readings_for_api(db: Session) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for obs, st in latest_level_rows_subquery(db):
        out.append(level_row_to_api_dict(obs, st))
    for obs, st in latest_discharge_rows_subquery(db):
        out.append(discharge_row_to_api_dict(obs, st))
    out.sort(key=lambda x: (x.get("station_name") or "", x.get("station_id") or "", x.get("param") or ""))
    return out
