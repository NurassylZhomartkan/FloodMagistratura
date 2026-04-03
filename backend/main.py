import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database.routers import auth, hec_ras, map_tiles, uploads, flood, custom_layers, open_meteo, hydro_stations

app = FastAPI(
    title="FloodSite API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Health-check
@app.get(
    "/",
    tags=["health"],
    summary="Проверка работоспособности API",
    description="Возвращает статус работы API. Используется для проверки доступности сервера."
)
async def root():
    """
    Проверка работоспособности API.
    
    Returns:
        dict: Словарь со статусом "ok" если сервер работает
    """
    return {"status": "ok"}

# CORS: в продакшене задайте CORS_ORIGINS=https://ваш-домен (через запятую для нескольких)
_cors_raw = os.getenv("CORS_ORIGINS", "").strip()
if _cors_raw:
    _cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]
else:
    _cors_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Сборка моделей и таблиц
@app.on_event("startup")
async def on_startup():
    from database.database import Base, SessionLocal, engine
    import database.models.user          # noqa: F401
    import database.models.hec_ras       # noqa: F401
    import database.models.custom_layer  # noqa: F401
    import database.models.flood         # noqa: F401
    import database.models.hydro_station   # noqa: F401
    import database.models.hydro_scrape_run  # noqa: F401
    try:
        Base.metadata.create_all(bind=engine)
        logging.info("✅ Tables created")
    except Exception as e:
        logging.error("❌ Could not initialize DB: %s", e)

    from database.hydro_station_io import (
        bootstrap_hydro_csv_if_database_empty,
        ensure_hydro_observations_schema,
        ensure_hydro_stations_schema,
        migrate_legacy_hydro_station_readings_if_needed,
        prune_observations_before_min_date,
        purge_hydro_outside_allowlist,
    )

    ensure_hydro_stations_schema()
    ensure_hydro_observations_schema()
    migrate_legacy_hydro_station_readings_if_needed()
    _db = SessionLocal()
    try:
        prune_observations_before_min_date(_db)
        removed = purge_hydro_outside_allowlist(_db)
        if any(removed.values()):
            logging.info("Гидро: удалены посты вне списка из 25: %s", removed)
    finally:
        _db.close()

    # Если нет наблюдений — подгружаем stations_all.csv (Selenium в dev часто недоступен)
    bootstrap_hydro_csv_if_database_empty()

    # Запускаем планировщик парсинга гидростанций
    from database.scheduler import start_scheduler
    start_scheduler()


@app.on_event("shutdown")
async def on_shutdown():
    from database.scheduler import stop_scheduler
    stop_scheduler()

# Роутеры
# ИСПРАВЛЕНО: Добавлен prefix="/auth" и тег для группировки в документации
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(hec_ras.router)   # /api/hec-ras/…
app.include_router(map_tiles.router)   # /api/map/…
app.include_router(uploads.router)   # /api/uploads/…
app.include_router(flood.router)   # /api/flood/…
app.include_router(custom_layers.router)   # /api/custom-layers/…
app.include_router(open_meteo.router)       # /api/open-meteo/…
app.include_router(hydro_stations.router)   # /api/hydro-stations/…

