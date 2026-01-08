"""
Скрипт для применения пропущенной миграции add_map_settings.
Добавляет столбцы default_map_style и default_map_projection в таблицу users.
"""
import sys
import os
from pathlib import Path

# Устанавливаем кодировку UTF-8 для вывода
if sys.platform == 'win32':
    os.system('chcp 65001 >nul')

# Добавляем корневую директорию backend в путь
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, text
from database.database import SQLALCHEMY_DATABASE_URL

def apply_migration():
    """Применяет миграцию add_map_settings напрямую."""
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    with engine.connect() as connection:
        # Начинаем транзакцию
        trans = connection.begin()
        try:
            # Проверяем, существуют ли уже столбцы
            check_query = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' 
                AND column_name IN ('default_map_style', 'default_map_projection')
            """)
            result = connection.execute(check_query)
            existing_columns = [row[0] for row in result]
            
            # Добавляем столбцы, если их нет
            if 'default_map_style' not in existing_columns:
                print("Добавляем столбец default_map_style...")
                connection.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN default_map_style VARCHAR(50)
                """))
                print("[OK] Столбец default_map_style добавлен")
            else:
                print("[OK] Столбец default_map_style уже существует")
            
            if 'default_map_projection' not in existing_columns:
                print("Добавляем столбец default_map_projection...")
                connection.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN default_map_projection VARCHAR(50)
                """))
                print("[OK] Столбец default_map_projection добавлен")
            else:
                print("[OK] Столбец default_map_projection уже существует")
            
            # Проверяем, применена ли уже миграция в alembic_version
            version_check = text("SELECT version_num FROM alembic_version")
            result = connection.execute(version_check)
            current_version = result.scalar()
            
            # Если миграция add_map_settings еще не записана в alembic_version,
            # но столбцы уже добавлены, это нормально - просто коммитим
            trans.commit()
            print("\n[OK] Миграция успешно применена!")
            
        except Exception as e:
            trans.rollback()
            print(f"\n[ERROR] Ошибка при применении миграции: {e}")
            raise
    
    engine.dispose()

if __name__ == "__main__":
    print("Применение миграции add_map_settings...")
    print("=" * 50)
    apply_migration()
    print("=" * 50)
    print("Готово!")

