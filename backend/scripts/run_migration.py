#!/usr/bin/env python3
"""
Скрипт для выполнения миграции базы данных.
Добавляет новые столбцы для подтверждения email и восстановления пароля.
"""

import sys
import os

# Добавляем путь к backend в sys.path
backend_path = os.path.dirname(os.path.abspath(__file__))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from database.database import engine
from sqlalchemy import text

def run_migration():
    """Выполняет миграцию для добавления полей подтверждения email."""
    
    with engine.connect() as conn:
        # Начинаем транзакцию
        trans = conn.begin()
        
        try:
            # Проверяем, существуют ли уже столбцы
            check_query = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'is_verified'
            """)
            result = conn.execute(check_query)
            
            if result.fetchone():
                print("[INFO] Migration already applied. Columns already exist.")
                trans.rollback()
                return
            
            print("[INFO] Running migration...")
            
            # Добавляем столбцы
            conn.execute(text("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false
            """))
            
            conn.execute(text("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS verification_token VARCHAR(256)
            """))
            
            conn.execute(text("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS reset_token VARCHAR(256)
            """))
            
            conn.execute(text("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE
            """))
            
            # Создаем индексы
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_users_verification_token 
                ON users(verification_token)
            """))
            
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_users_reset_token 
                ON users(reset_token)
            """))
            
            # Устанавливаем значение по умолчанию для существующих пользователей
            conn.execute(text("""
                UPDATE users 
                SET is_verified = false 
                WHERE is_verified IS NULL
            """))
            
            # Коммитим транзакцию
            trans.commit()
            print("[OK] Migration completed successfully!")
            
        except Exception as e:
            trans.rollback()
            print(f"[ERROR] Migration failed: {e}")
            raise

if __name__ == "__main__":
    run_migration()

