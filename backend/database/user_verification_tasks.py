# backend/database/user_verification_tasks.py

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from database.database import SessionLocal
from database.models.user import User
from database import crud

# Глобальный словарь для хранения задач проверки пользователей
# Ключ: user_id, Значение: asyncio.Task или asyncio.Future
user_verification_tasks: dict[int, asyncio.Task | asyncio.Future] = {}

# Глобальная переменная для хранения event loop
_event_loop: asyncio.AbstractEventLoop | None = None

# Глобальная переменная для хранения периодической задачи очистки
_cleanup_task: asyncio.Task | None = None

def set_event_loop(loop: asyncio.AbstractEventLoop):
    """Устанавливает глобальный event loop для создания задач."""
    global _event_loop
    _event_loop = loop

async def check_and_delete_user(user_id: int, created_at: datetime):
    """
    Индивидуальная задача для проверки конкретного пользователя.
    Проверяет каждую минуту в течение 10 минут после регистрации.
    Если пользователь не подтвердил email, удаляет его.
    """
    try:
        logging.info(f"🔍 Начата проверка пользователя {user_id}, создан: {created_at}")
        for minute in range(10):  # Проверяем 10 раз (каждую минуту)
            await asyncio.sleep(60)  # Ждем 1 минуту
            
            # Проверяем, не был ли пользователь удален или подтвержден
            db = SessionLocal()
            try:
                user = db.query(User).filter(User.id == user_id).first()
                
                # Если пользователь не найден (уже удален) или подтвержден, отменяем задачу
                if not user:
                    logging.info(f"✅ Пользователь {user_id} уже удален, отмена проверки")
                    break
                
                if user.is_verified:
                    logging.info(f"✅ Пользователь {user_id} подтвердил email, отмена проверки")
                    break
                
                # Проверяем, прошло ли 10 минут с момента регистрации
                # Убеждаемся, что created_at имеет timezone
                user_created = user.created
                if user_created.tzinfo is None:
                    # Если timezone отсутствует, предполагаем UTC
                    user_created = user_created.replace(tzinfo=timezone.utc)
                
                elapsed = datetime.now(timezone.utc) - user_created
                elapsed_minutes = elapsed.total_seconds() / 60
                logging.debug(f"⏱️ Пользователь {user_id}: прошло {elapsed_minutes:.1f} минут с момента регистрации")
                
                if elapsed >= timedelta(minutes=10):
                    # Удаляем пользователя, если он не подтвержден
                    if not user.is_verified:
                        db.delete(user)
                        db.commit()
                        logging.info(f"✅ Удален неподтвержденный пользователь {user_id} (не подтвердил email в течение 10 минут, прошло {elapsed_minutes:.1f} минут)")
                    break
            except Exception as e:
                logging.error(f"❌ Ошибка при проверке пользователя {user_id}: {e}", exc_info=True)
            finally:
                db.close()
    except asyncio.CancelledError:
        logging.info(f"⏹️ Задача проверки пользователя {user_id} отменена")
    finally:
        # Удаляем задачу из словаря
        user_verification_tasks.pop(user_id, None)

def schedule_user_verification(user_id: int, created_at: datetime):
    """
    Запускает индивидуальную задачу проверки для пользователя.
    Вызывается при регистрации пользователя.
    """
    global _event_loop
    
    if _event_loop is None:
        logging.error(f"❌ Event loop не установлен. Задача проверки пользователя {user_id} не может быть запущена.")
        logging.warning(f"⚠️ Пользователь {user_id} будет удален только периодической задачей очистки")
        return
    
    # Используем run_coroutine_threadsafe для запуска из синхронного контекста
    # Это работает даже если мы вызываем из другого потока
    try:
        task = asyncio.run_coroutine_threadsafe(
            check_and_delete_user(user_id, created_at),
            _event_loop
        )
        user_verification_tasks[user_id] = task
        logging.info(f"✅ Запущена индивидуальная задача проверки для пользователя {user_id} (будет проверяться каждую минуту в течение 10 минут)")
    except Exception as e:
        logging.error(f"❌ Ошибка при запуске задачи проверки пользователя {user_id}: {e}")
        logging.warning(f"⚠️ Пользователь {user_id} будет удален только периодической задачей очистки")

def cancel_user_verification(user_id: int):
    """
    Отменяет задачу проверки для пользователя.
    Вызывается при подтверждении email.
    """
    task = user_verification_tasks.pop(user_id, None)
    if task:
        # Проверяем, является ли это Future (от run_coroutine_threadsafe)
        if isinstance(task, asyncio.Future):
            if not task.done():
                task.cancel()
                logging.info(f"Задача проверки для пользователя {user_id} отменена")
        elif not task.done():
            task.cancel()
            logging.info(f"Задача проверки для пользователя {user_id} отменена")

async def periodic_cleanup_unverified_users():
    """
    Периодическая задача для удаления неподтвержденных пользователей старше 10 минут.
    Запускается каждые 2 минуты как резервный механизм.
    """
    while True:
        try:
            await asyncio.sleep(120)  # Ждем 2 минуты между проверками
            
            db = SessionLocal()
            try:
                # Удаляем неподтвержденных пользователей старше 10 минут
                deleted_count = crud.delete_unverified_users_older_than(db, minutes=10)
                if deleted_count > 0:
                    logging.info(f"✅ Периодическая очистка: удалено {deleted_count} неподтвержденных пользователей")
            except Exception as e:
                logging.error(f"❌ Ошибка при периодической очистке неподтвержденных пользователей: {e}")
            finally:
                db.close()
        except asyncio.CancelledError:
            logging.info("Периодическая задача очистки неподтвержденных пользователей отменена")
            break
        except Exception as e:
            logging.error(f"❌ Критическая ошибка в периодической задаче очистки: {e}")
            await asyncio.sleep(60)  # Ждем минуту перед повтором при ошибке

def start_periodic_cleanup():
    """
    Запускает периодическую задачу очистки неподтвержденных пользователей.
    Вызывается при старте приложения.
    """
    global _event_loop, _cleanup_task
    
    if _event_loop is None:
        logging.error("Event loop не установлен. Периодическая задача очистки не может быть запущена.")
        return
    
    try:
        _cleanup_task = asyncio.run_coroutine_threadsafe(
            periodic_cleanup_unverified_users(),
            _event_loop
        )
        logging.info("✅ Запущена периодическая задача очистки неподтвержденных пользователей (каждые 2 минуты)")
    except Exception as e:
        logging.error(f"❌ Ошибка при запуске периодической задачи очистки: {e}")

def stop_periodic_cleanup():
    """
    Останавливает периодическую задачу очистки.
    Вызывается при остановке приложения.
    """
    global _cleanup_task
    if _cleanup_task and not _cleanup_task.done():
        _cleanup_task.cancel()
        logging.info("Периодическая задача очистки остановлена")

