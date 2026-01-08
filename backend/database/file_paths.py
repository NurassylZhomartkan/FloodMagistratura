# backend/database/file_paths.py
"""
Централизованное управление путями к загруженным файлам.
Все пути относительно директории backend.

Структура проекта:
backend/
  uploads/          - Загруженные пользователями файлы
    avatars/        - Аватары пользователей
    projects/       - HEC-RAS проекты (.db файлы)
    files/          - Другие загруженные файлы
  data/             - Данные приложения
    databases/      - Файлы баз данных
    mbtiles/        - Тайлы карт
  docs/             - Документация
  scripts/          - Скрипты миграции и утилиты
  migrations/       - Alembic миграции
"""

from pathlib import Path

# Базовая директория backend
BACKEND_DIR = Path(__file__).parent.parent

# Структура папок для загруженных файлов
UPLOADS_DIR = BACKEND_DIR / "uploads"

# Подпапки по типам файлов
AVATARS_DIR = UPLOADS_DIR / "avatars"
PROJECTS_DIR = UPLOADS_DIR / "projects"
FILES_DIR = UPLOADS_DIR / "files"

# Директории данных
DATA_DIR = BACKEND_DIR / "data"
DATABASES_DIR = DATA_DIR / "databases"
MBTILES_DIR = DATA_DIR / "mbtiles"

# Другие директории
DOCS_DIR = BACKEND_DIR / "docs"
SCRIPTS_DIR = BACKEND_DIR / "scripts"
MIGRATIONS_DIR = BACKEND_DIR / "migrations"


def ensure_directories():
    """Создает все необходимые директории, если они не существуют."""
    AVATARS_DIR.mkdir(parents=True, exist_ok=True)
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    FILES_DIR.mkdir(parents=True, exist_ok=True)
    DATABASES_DIR.mkdir(parents=True, exist_ok=True)
    MBTILES_DIR.mkdir(parents=True, exist_ok=True)
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)


def get_avatar_path(filename: str) -> Path:
    """Возвращает полный путь к файлу аватара."""
    return AVATARS_DIR / filename


def get_project_path(filename: str) -> Path:
    """Возвращает полный путь к файлу проекта."""
    return PROJECTS_DIR / filename


def get_file_path(filename: str) -> Path:
    """Возвращает полный путь к загруженному файлу."""
    return FILES_DIR / filename


def get_mbtiles_path(filename: str) -> Path:
    """Возвращает полный путь к файлу mbtiles."""
    return MBTILES_DIR / filename


def get_database_path(filename: str) -> Path:
    """Возвращает полный путь к файлу базы данных."""
    return DATABASES_DIR / filename


def get_docs_path(filename: str) -> Path:
    """Возвращает полный путь к файлу документации."""
    return DOCS_DIR / filename


def get_script_path(filename: str) -> Path:
    """Возвращает полный путь к скрипту."""
    return SCRIPTS_DIR / filename


def get_terrain_file_path(filename: str) -> Path:
    """Возвращает полный путь к файлу рельефа."""
    terrain_dir = FILES_DIR / "terrain"
    terrain_dir.mkdir(parents=True, exist_ok=True)
    return terrain_dir / filename

