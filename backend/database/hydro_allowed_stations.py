"""
Гидропосты, отображаемые в приложении (/app/stations, категория 2 в posts.json).
Парсинг и БД работают только с этими ID; остальные не сохраняются и удаляются при старте.
"""

from __future__ import annotations

from typing import Any

# Совпадает с белым списком графика на странице БД и с наборами постов карты (25 шт.)
ALLOWED_HYDRO_STATION_IDS: frozenset[str] = frozenset(
    str(i)
    for i in (
        11001,
        11094,
        11108,
        11117,
        11126,
        11129,
        11146,
        11147,
        11164,
        11207,
        11170,
        11063,
        11068,
        11187,
        11124,
        11143,
        11163,
        11188,
        11661,
        11668,
        11160,
        11077,
        11131,
        11199,
        11219,
    )
)


def normalize_station_id(val: Any) -> str:
    if val is None or (isinstance(val, str) and not val.strip()):
        return ""
    s = str(val).strip()
    try:
        return str(int(float(s.replace(",", "."))))
    except (ValueError, TypeError):
        return s


def is_allowed_hydro_station_id(station_id: Any) -> bool:
    return normalize_station_id(station_id) in ALLOWED_HYDRO_STATION_IDS


def filter_rows_to_allowed_hydro_stations(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [r for r in rows if is_allowed_hydro_station_id(r.get("station_id"))]
