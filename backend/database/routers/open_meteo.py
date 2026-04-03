"""
Роутер для получения метеорологических и гидрологических данных
из Open-Meteo API (https://open-meteo.com).

Использует официальный SDK openmeteo-requests с кэшированием и retry.
Хэндлеры синхронные — FastAPI запускает их в thread pool автоматически,
что корректно работает с синхронным SDK.

Эндпоинты:
  - /api/open-meteo/forecast    — прогноз погоды (до 16 дней) + текущие данные
  - /api/open-meteo/historical  — исторические данные
  - /api/open-meteo/flood       — расход воды в реках (GloFAS)
"""

import logging
from datetime import date
from typing import Optional

import numpy as np
import openmeteo_requests
import pandas as pd
import requests_cache
from fastapi import APIRouter, HTTPException, Query
from retry_requests import retry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/open-meteo", tags=["Open-Meteo"])

_cache_session = requests_cache.CachedSession(".cache", expire_after=3600)
_retry_session = retry(_cache_session, retries=5, backoff_factor=0.2)
_client = openmeteo_requests.Client(session=_retry_session)

BASE_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
BASE_HISTORICAL_URL = "https://archive-api.open-meteo.com/v1/archive"
BASE_FLOOD_URL = "https://flood-api.open-meteo.com/v1/flood"

HOURLY_VARS = [
    "temperature_2m",
    "snow_depth",
    "relative_humidity_2m",
    "rain",
    "precipitation_probability",
    "pressure_msl",
]

CURRENT_VARS = [
    "temperature_2m",
    "relative_humidity_2m",
    "apparent_temperature",
    "is_day",
    "precipitation",
    "rain",
    "cloud_cover",
    "surface_pressure",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
]

DAILY_VARS = [
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
    "precipitation_hours",
    "wind_speed_10m_max",
    "sunrise",
    "sunset",
]

FLOOD_DAILY_VARS = [
    "river_discharge",
    "river_discharge_mean",
    "river_discharge_median",
    "river_discharge_max",
    "river_discharge_min",
    "river_discharge_p25",
    "river_discharge_p75",
]


def _nan_to_none(val):
    """Конвертирует numpy-типы и NaN в JSON-совместимые значения."""
    if isinstance(val, (np.floating, float)) and np.isnan(val):
        return None
    if isinstance(val, np.generic):
        return val.item()
    return val


def _parse_response_meta(response) -> dict:
    return {
        "latitude": response.Latitude(),
        "longitude": response.Longitude(),
        "elevation": response.Elevation(),
        "utc_offset_seconds": response.UtcOffsetSeconds(),
    }


def _parse_current(response, var_names: list[str]) -> dict:
    current = response.Current()
    if current is None:
        return {}
    result = {"time": int(current.Time())}
    for i, name in enumerate(var_names):
        result[name] = _nan_to_none(current.Variables(i).Value())
    return result


def _parse_hourly(response, var_names: list[str]) -> list[dict]:
    hourly = response.Hourly()
    if hourly is None:
        return []

    dates = pd.date_range(
        start=pd.to_datetime(hourly.Time(), unit="s", utc=True),
        end=pd.to_datetime(hourly.TimeEnd(), unit="s", utc=True),
        freq=pd.Timedelta(seconds=hourly.Interval()),
        inclusive="left",
    )

    arrays = {}
    for i, name in enumerate(var_names):
        arrays[name] = hourly.Variables(i).ValuesAsNumpy()

    records = []
    for j, dt in enumerate(dates):
        row = {"time": dt.isoformat()}
        for name in var_names:
            row[name] = _nan_to_none(arrays[name][j])
        records.append(row)

    return records


def _parse_daily(response, var_names: list[str]) -> list[dict]:
    daily = response.Daily()
    if daily is None:
        return []

    dates = pd.date_range(
        start=pd.to_datetime(daily.Time(), unit="s", utc=True),
        end=pd.to_datetime(daily.TimeEnd(), unit="s", utc=True),
        freq=pd.Timedelta(seconds=daily.Interval()),
        inclusive="left",
    )

    arrays = {}
    for i, name in enumerate(var_names):
        try:
            arr = daily.Variables(i).ValuesAsNumpy()
        except Exception:
            arr = daily.Variables(i).Value()
        arrays[name] = arr

    records = []
    for j, dt in enumerate(dates):
        row = {"date": dt.strftime("%Y-%m-%d")}
        for name in var_names:
            val = arrays[name]
            if hasattr(val, '__getitem__') and not isinstance(val, (str, int, float)):
                row[name] = _nan_to_none(val[j])
            else:
                row[name] = _nan_to_none(val)
        records.append(row)

    return records


def _fetch_forecast(params: dict) -> dict:
    responses = _client.weather_api(BASE_FORECAST_URL, params=params)
    return responses[0]


# ── Прогноз погоды ──────────────────────────────────────────────

@router.get(
    "/forecast",
    summary="Прогноз погоды (до 16 дней) + текущие данные",
    description=(
        "Возвращает текущие, почасовые и дневные метеоданные для указанных координат. "
        "Данные предоставляются Open-Meteo (бесплатно, без ключа). "
        "Кэширование — 1 час, автоматический retry при ошибках."
    ),
)
def get_weather_forecast(
    latitude: float = Query(..., ge=-90, le=90, description="Широта"),
    longitude: float = Query(..., ge=-180, le=180, description="Долгота"),
    forecast_days: int = Query(7, ge=1, le=16, description="Количество дней прогноза"),
    past_days: int = Query(3, ge=0, le=92, description="Прошедшие дни (архив)"),
    hourly: Optional[str] = Query(None, description="Почасовые переменные через запятую"),
    daily: Optional[str] = Query(None, description="Дневные переменные через запятую"),
    current: Optional[str] = Query(None, description="Текущие переменные через запятую"),
):
    hourly_vars = hourly.split(",") if hourly else HOURLY_VARS
    daily_vars = daily.split(",") if daily else DAILY_VARS
    current_vars = current.split(",") if current else CURRENT_VARS

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": hourly_vars,
        "daily": daily_vars,
        "current": current_vars,
        "forecast_days": forecast_days,
        "past_days": past_days,
    }

    try:
        response = _fetch_forecast(params)
    except Exception as e:
        logger.error("Open-Meteo forecast error: %s", e)
        raise HTTPException(status_code=502, detail=f"Open-Meteo API error: {e}")

    return {
        **_parse_response_meta(response),
        "current": _parse_current(response, current_vars),
        "hourly": _parse_hourly(response, hourly_vars),
        "daily": _parse_daily(response, daily_vars),
    }


# ── Исторические данные ─────────────────────────────────────────

@router.get(
    "/historical",
    summary="Исторические метеоданные",
    description=(
        "Возвращает архивные метеоданные за указанный период (с 1940 г.). "
        "Максимальный диапазон — один год за запрос."
    ),
)
def get_historical_weather(
    latitude: float = Query(..., ge=-90, le=90, description="Широта"),
    longitude: float = Query(..., ge=-180, le=180, description="Долгота"),
    start_date: date = Query(..., description="Начальная дата (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Конечная дата (YYYY-MM-DD)"),
    hourly: Optional[str] = Query(None, description="Почасовые переменные через запятую"),
    daily: Optional[str] = Query(None, description="Дневные переменные через запятую"),
):
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="end_date должна быть >= start_date")
    if (end_date - start_date).days > 366:
        raise HTTPException(status_code=400, detail="Максимальный диапазон — 366 дней")

    hourly_vars = hourly.split(",") if hourly else HOURLY_VARS
    daily_vars = daily.split(",") if daily else DAILY_VARS

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "hourly": hourly_vars,
        "daily": daily_vars,
    }

    try:
        responses = _client.weather_api(BASE_HISTORICAL_URL, params=params)
    except Exception as e:
        logger.error("Open-Meteo historical error: %s", e)
        raise HTTPException(status_code=502, detail=f"Open-Meteo API error: {e}")

    response = responses[0]

    return {
        **_parse_response_meta(response),
        "hourly": _parse_hourly(response, hourly_vars),
        "daily": _parse_daily(response, daily_vars),
    }


# ── Паводковые данные (расход воды) ─────────────────────────────

@router.get(
    "/flood",
    summary="Прогноз расхода воды в реке (GloFAS)",
    description=(
        "Возвращает прогноз и/или исторические данные о расходе воды "
        "из ближайшей реки (разрешение ~5 км). "
        "Используется модель GloFAS Copernicus."
    ),
)
def get_flood_data(
    latitude: float = Query(..., ge=-90, le=90, description="Широта"),
    longitude: float = Query(..., ge=-180, le=180, description="Долгота"),
    forecast_days: int = Query(7, ge=1, le=210, description="Дни прогноза (макс. 210)"),
    past_days: int = Query(0, ge=0, le=92, description="Прошедшие дни"),
    daily: Optional[str] = Query(None, description="Переменные расхода через запятую"),
):
    daily_vars = daily.split(",") if daily else FLOOD_DAILY_VARS

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "daily": daily_vars,
        "forecast_days": forecast_days,
        "past_days": past_days,
    }

    try:
        responses = _client.weather_api(BASE_FLOOD_URL, params=params)
    except Exception as e:
        logger.error("Open-Meteo flood error: %s", e)
        raise HTTPException(status_code=502, detail=f"Open-Meteo API error: {e}")

    response = responses[0]

    return {
        **_parse_response_meta(response),
        "daily": _parse_daily(response, daily_vars),
    }


# ── Мульти-точечный запрос ──────────────────────────────────────

@router.post(
    "/forecast/multi",
    summary="Прогноз погоды для нескольких точек",
    description="Принимает список координат и возвращает прогноз для каждой точки.",
)
def get_multi_forecast(
    points: list[dict],
    forecast_days: int = Query(7, ge=1, le=16),
    past_days: int = Query(3, ge=0, le=92),
):
    """
    Тело запроса — JSON-массив точек:
    [{"latitude": 51.1, "longitude": 71.4, "name": "Астана"}, ...]
    """
    results = []

    for pt in points:
        lat = pt.get("latitude")
        lon = pt.get("longitude")
        if lat is None or lon is None:
            results.append({"error": "latitude/longitude обязательны", "point": pt})
            continue

        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": HOURLY_VARS,
            "daily": DAILY_VARS,
            "current": CURRENT_VARS,
            "forecast_days": forecast_days,
            "past_days": past_days,
        }

        try:
            response = _fetch_forecast(params)
            results.append({
                "name": pt.get("name", ""),
                **_parse_response_meta(response),
                "current": _parse_current(response, CURRENT_VARS),
                "hourly": _parse_hourly(response, HOURLY_VARS),
                "daily": _parse_daily(response, DAILY_VARS),
            })
        except Exception as e:
            results.append({"error": str(e), "point": pt})

    return {"results": results}
