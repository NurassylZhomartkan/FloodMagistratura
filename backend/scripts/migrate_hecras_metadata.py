#!/usr/bin/env python3
"""
Скрипт миграции данных для извлечения метаданных из .db файлов
для существующих проектов HEC-RAS.

Запуск:
    python migrate_hecras_metadata.py
"""

import os
import sys
import logging
from pathlib import Path

# Добавляем текущую директорию в путь для импортов
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.orm import Session
from database.database import SessionLocal, engine
from database.models.hec_ras import HecRasProject
from database.utils import extract_hecras_data

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def migrate_hecras_metadata():
    """
    Мигрирует метаданные для всех существующих проектов HEC-RAS.
    Для каждого проекта:
    1. Проверяет наличие .db файла
    2. Если файл существует, извлекает метаданные
    3. Обновляет запись в базе данных
    """
    db: Session = SessionLocal()
    
    try:
        # Получаем все проекты
        projects = db.query(HecRasProject).all()
        logger.info(f"Найдено {len(projects)} проектов для миграции")
        
        updated_count = 0
        skipped_count = 0
        error_count = 0
        
        for project in projects:
            logger.info(f"Обработка проекта ID={project.id}, name='{project.name}', filepath='{project.filepath}'")
            
            # Проверяем наличие файла
            if not project.filepath:
                logger.warning(f"Проект ID={project.id} не имеет filepath, пропускаем")
                skipped_count += 1
                continue
            
            if not os.path.exists(project.filepath):
                logger.warning(f"Файл не найден: {project.filepath}, пропускаем")
                skipped_count += 1
                continue
            
            # Проверяем, нужно ли обновлять метаданные
            # Обновляем, если метаданные отсутствуют или неполные
            needs_update = False
            
            if not project.project_metadata:
                logger.info(f"Проект ID={project.id} не имеет метаданных, извлекаем...")
                needs_update = True
            else:
                # Проверяем наличие ключевых метаданных
                metadata = project.project_metadata
                # Ищем метаданные с префиксами (например, Maleevsk_)
                has_metadata = any(
                    key.endswith(('_maxzoom', '_centerx', '_centery', '_centerz', 
                                 '_bottom', '_top', '_left', '_right',
                                 '_project_name', '_plan_name', '_map_type',
                                 '_legend_values', '_legend_rgba'))
                    for key in metadata.keys()
                )
                
                if not has_metadata:
                    logger.info(f"Проект ID={project.id} имеет неполные метаданные, обновляем...")
                    needs_update = True
                else:
                    logger.info(f"Проект ID={project.id} уже имеет метаданные, пропускаем")
                    skipped_count += 1
                    continue
            
            if needs_update:
                try:
                    # Извлекаем метаданные из .db файла
                    logger.info(f"Извлечение метаданных из {project.filepath}...")
                    hecras_data = extract_hecras_data(project.filepath)
                    
                    extracted_metadata = hecras_data.get("metadata", {})
                    extracted_layers = hecras_data.get("layers", [])
                    
                    if extracted_metadata or extracted_layers:
                        # Объединяем существующие метаданные с новыми (новые имеют приоритет)
                        if project.project_metadata:
                            project.project_metadata.update(extracted_metadata)
                        else:
                            project.project_metadata = extracted_metadata
                        
                        if extracted_layers:
                            project.layers = extracted_layers
                        
                        # Сохраняем изменения
                        db.commit()
                        db.refresh(project)
                        
                        logger.info(f"✅ Проект ID={project.id} успешно обновлен")
                        logger.info(f"   Извлечено метаданных: {len(extracted_metadata)}")
                        logger.info(f"   Извлечено слоев: {len(extracted_layers)}")
                        
                        # Логируем ключевые метаданные
                        if extracted_metadata:
                            key_metadata = [
                                k for k in extracted_metadata.keys() 
                                if any(k.endswith(suffix) for suffix in [
                                    '_maxzoom', '_centerx', '_centery', '_centerz',
                                    '_project_name', '_plan_name', '_map_type',
                                    '_legend_values', '_legend_rgba'
                                ])
                            ]
                            if key_metadata:
                                logger.info(f"   Ключевые метаданные: {key_metadata[:5]}...")
                        
                        updated_count += 1
                    else:
                        logger.warning(f"⚠️  Не удалось извлечь метаданные из {project.filepath}")
                        error_count += 1
                        
                except Exception as e:
                    logger.error(f"❌ Ошибка при обработке проекта ID={project.id}: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
                    db.rollback()
                    error_count += 1
        
        # Итоговая статистика
        logger.info("=" * 60)
        logger.info("МИГРАЦИЯ ЗАВЕРШЕНА")
        logger.info(f"Обновлено проектов: {updated_count}")
        logger.info(f"Пропущено проектов: {skipped_count}")
        logger.info(f"Ошибок: {error_count}")
        logger.info(f"Всего обработано: {len(projects)}")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"Критическая ошибка при миграции: {e}")
        import traceback
        logger.error(traceback.format_exc())
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    logger.info("Запуск миграции метаданных HEC-RAS проектов...")
    migrate_hecras_metadata()
    logger.info("Миграция завершена.")



