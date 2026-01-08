# -*- coding: utf-8 -*-
"""
Скрипт для выполнения миграции базы данных.
Добавляет поля для изменения email с подтверждением по коду.
Запускать из директории backend: python migrate_email_change_fields.py
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
    """Выполняет миграцию для добавления полей изменения email."""
    
    with engine.connect() as conn:
        # Начинаем транзакцию
        trans = conn.begin()
        
        try:
            # Проверяем, существуют ли уже столбцы
            check_query = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'pending_email'
            """)
            result = conn.execute(check_query)
            
            if result.fetchone():
                print("[INFO] Migration already applied. Columns already exist.")
                trans.rollback()
                return
            
            print("[INFO] Running migration for email change fields...")
            
            # Добавляем столбцы
            conn.execute(text("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS pending_email VARCHAR(256)
            """))
            
            conn.execute(text("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS email_change_code VARCHAR(10)
            """))
            
            conn.execute(text("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS email_change_code_expires TIMESTAMP WITH TIME ZONE
            """))
            
            # Создаем индекс для email_change_code
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_users_email_change_code 
                ON users(email_change_code)
            """))
            
            trans.commit()
            print("[INFO] Migration completed successfully!")
            
        except Exception as e:
            trans.rollback()
            print(f"[ERROR] Migration failed: {e}")
            raise

if __name__ == "__main__":
    run_migration()

