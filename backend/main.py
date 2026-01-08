import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database.routers import auth, hec_ras, map_tiles, uploads, flood, custom_layers

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

# CORS (Vite dev проксирует, но на всякий случай)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Сборка моделей и таблиц
@app.on_event("startup")
async def on_startup():
    from database.database import Base, engine
    import database.models.user      # noqa: F401
    import database.models.hec_ras   # noqa: F401
    import database.models.custom_layer   # noqa: F401
    import database.models.flood   # noqa: F401
    try:
        Base.metadata.create_all(bind=engine)
        logging.info("✅ Tables created")
    except Exception as e:
        logging.error("❌ Could not initialize DB: %s", e)

# Роутеры
# ИСПРАВЛЕНО: Добавлен prefix="/auth" и тег для группировки в документации
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(hec_ras.router)   # /api/hec-ras/…
app.include_router(map_tiles.router)   # /api/map/…
app.include_router(uploads.router)   # /api/uploads/…
app.include_router(flood.router)   # /api/flood/…
app.include_router(custom_layers.router)   # /api/custom-layers/…

