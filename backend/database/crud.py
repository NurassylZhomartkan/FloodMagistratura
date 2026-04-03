# backend/database/crud.py

import secrets
import random
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from database.models.hec_ras import HecRasProject
from database.models.user import User
from database.models.custom_layer import CustomLayer
from database.models.flood import FloodProject
from database.schemas import UserCreate
# ИСПРАВЛЕННЫЙ ИМПОРТ:
from database.security import hash_password

# ============= Функции для пользователей =============

def get_user_by_username(db: Session, username: str):
    """
    Возвращает пользователя по имени.
    """
    return db.query(User).filter(User.username == username).first()

def get_user_by_email(db: Session, email: str):
    """
    Возвращает пользователя по email.
    """
    return db.query(User).filter(User.email == email).first()

def create_user(db: Session, user: UserCreate):
    """
    Создаёт нового пользователя с хэшированным паролем и токеном подтверждения.
    """
    # ИСПРАВЛЕННЫЙ ВЫЗОВ ФУНКЦИИ:
    hashed_password = hash_password(user.password)
    verification_token = secrets.token_urlsafe(32)
    # Валидируем язык, если неверный - используем 'ru'
    language = user.language if user.language in ['ru', 'en', 'kz'] else 'ru'
    db_user = User(
        username=user.username,
        email=user.email,
        password=hashed_password,
        is_verified=False,
        verification_token=verification_token,
        language=language
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_user_by_verification_token(db: Session, token: str):
    """
    Возвращает пользователя по токену подтверждения email.
    """
    return db.query(User).filter(User.verification_token == token).first()

def verify_user_email(db: Session, token: str) -> bool:
    """
    Подтверждает email пользователя по токену.
    Возвращает True при успехе, False если токен не найден.
    """
    user = get_user_by_verification_token(db, token)
    if not user:
        return False
    user.is_verified = True
    user.verification_token = None
    db.commit()
    return True

def get_user_by_reset_token(db: Session, token: str):
    """
    Возвращает пользователя по токену восстановления пароля, если токен не истек.
    """
    user = db.query(User).filter(User.reset_token == token).first()
    if not user:
        return None
    if user.reset_token_expires and user.reset_token_expires < datetime.now(timezone.utc):
        return None
    return user

def set_password_reset_token(db: Session, email: str) -> str | None:
    """
    Устанавливает токен восстановления пароля для пользователя.
    Возвращает токен или None, если пользователь не найден.
    """
    user = get_user_by_email(db, email)
    if not user:
        return None
    reset_token = secrets.token_urlsafe(32)
    user.reset_token = reset_token
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)
    db.commit()
    return reset_token

def reset_user_password(db: Session, token: str, new_password: str) -> bool:
    """
    Сбрасывает пароль пользователя по токену.
    Возвращает True при успехе, False если токен недействителен.
    """
    user = get_user_by_reset_token(db, token)
    if not user:
        return False
    user.password = hash_password(new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()
    return True

def request_email_change(db: Session, user_id: int, new_email: str) -> str | None:
    """
    Запрашивает изменение email. Сохраняет новый email во временное поле и генерирует код подтверждения.
    Возвращает код подтверждения или None, если email уже занят.
    """
    # Проверяем, не занят ли email другим пользователем
    existing_user = get_user_by_email(db, new_email)
    if existing_user and existing_user.id != user_id:
        return None
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None
    
    # Генерируем 6-значный код
    code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
    
    # Сохраняем новый email во временное поле и код подтверждения
    user.pending_email = new_email
    user.email_change_code = code
    user.email_change_code_expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    db.commit()
    return code

def verify_email_change_code(db: Session, user_id: int, code: str) -> bool:
    """
    Проверяет код подтверждения и обновляет email пользователя.
    Возвращает True при успехе, False если код неверный или истек.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    
    # Проверяем наличие кода и нового email
    if not user.email_change_code or not user.pending_email:
        return False
    
    # Проверяем срок действия кода
    if user.email_change_code_expires and user.email_change_code_expires < datetime.now(timezone.utc):
        # Очищаем истекший код
        user.email_change_code = None
        user.email_change_code_expires = None
        user.pending_email = None
        db.commit()
        return False
    
    # Проверяем код
    if user.email_change_code != code:
        return False
    
    # Проверяем, не занят ли email другим пользователем (на случай, если изменилось с момента запроса)
    existing_user = get_user_by_email(db, user.pending_email)
    if existing_user and existing_user.id != user_id:
        # Очищаем данные
        user.email_change_code = None
        user.email_change_code_expires = None
        user.pending_email = None
        db.commit()
        return False
    
    # Обновляем email
    user.email = user.pending_email
    user.is_verified = False  # Требуется повторная верификация нового email
    user.verification_token = secrets.token_urlsafe(32)
    
    # Очищаем временные поля
    user.pending_email = None
    user.email_change_code = None
    user.email_change_code_expires = None
    db.commit()
    return True

def update_user_email(db: Session, user_id: int, new_email: str) -> bool:
    """
    Обновляет email пользователя и создает новый токен подтверждения.
    Возвращает True при успехе, False если email уже занят.
    УСТАРЕВШАЯ ФУНКЦИЯ - используется для обратной совместимости.
    """
    # Проверяем, не занят ли email другим пользователем
    existing_user = get_user_by_email(db, new_email)
    if existing_user and existing_user.id != user_id:
        return False
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    
    user.email = new_email
    user.is_verified = False
    user.verification_token = secrets.token_urlsafe(32)
    db.commit()
    return True

def update_user_map_settings(db: Session, user_id: int, map_style: str = None, map_projection: str = None) -> bool:
    """
    Обновляет настройки карты пользователя.
    Возвращает True при успехе, False если пользователь не найден.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    
    if map_style is not None:
        user.default_map_style = map_style
    if map_projection is not None:
        user.default_map_projection = map_projection
    
    db.commit()
    return True

def update_user_password(db: Session, user_id: int, new_password: str) -> bool:
    """
    Обновляет пароль пользователя.
    Возвращает True при успехе, False если пользователь не найден.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    user.password = hash_password(new_password)
    db.commit()
    return True

def update_user_avatar(db: Session, user_id: int, avatar_url: str) -> bool:
    """
    Обновляет URL аватара пользователя.
    Возвращает True при успехе, False если пользователь не найден.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    user.avatar_url = avatar_url
    db.commit()
    return True

def delete_user_avatar(db: Session, user_id: int) -> bool:
    """
    Удаляет аватар пользователя (устанавливает avatar_url в None).
    Возвращает True при успехе, False если пользователь не найден.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    user.avatar_url = None
    db.commit()
    return True

def delete_unverified_users_older_than(db: Session, minutes: int = 13) -> int:
    """
    Удаляет неподтвержденных пользователей, которые были созданы более указанного количества минут назад.
    Возвращает количество удаленных пользователей.
    """
    import logging
    
    cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    
    # Находим всех неподтвержденных пользователей, созданных до cutoff_time
    unverified_users = (
        db.query(User)
        .filter(
            User.is_verified == False,
            User.created < cutoff_time
        )
        .all()
    )
    
    deleted_count = 0
    for user in unverified_users:
        try:
            # Вычисляем, сколько времени прошло с момента создания
            user_created = user.created
            if user_created.tzinfo is None:
                user_created = user_created.replace(tzinfo=timezone.utc)
            
            elapsed = datetime.now(timezone.utc) - user_created
            elapsed_minutes = elapsed.total_seconds() / 60
            
            db.delete(user)
            deleted_count += 1
            logging.info(f"🗑️ Удален неподтвержденный пользователь ID={user.id}, username={user.username}, email={user.email} (прошло {elapsed_minutes:.1f} минут)")
        except Exception as e:
            # Логируем ошибку, но продолжаем удаление других пользователей
            logging.error(f"❌ Ошибка при удалении пользователя {user.id}: {e}", exc_info=True)
            continue
    
    if deleted_count > 0:
        db.commit()
        logging.info(f"✅ Удалено {deleted_count} неподтвержденных пользователей старше {minutes} минут")
    
    return deleted_count

# ============= Функции для проектов HEC-RAS =============

def list_hecras_projects(db: Session, owner_id: int):
    """
    Возвращает все HecRasProject этого пользователя.
    """
    return (
        db.query(HecRasProject)
          .filter(HecRasProject.owner_id == owner_id)
          .all()
    )

def get_hecras_project(db: Session, project_id: int, owner_id: int):
    """
    Возвращает один проект (или None).
    """
    return (
        db.query(HecRasProject)
          .filter(
             HecRasProject.id == project_id,
             HecRasProject.owner_id == owner_id
          )
          .first()
    )

def create_hecras_project(
    db: Session,
    name: str,
    filepath: str,
    owner_id: int,
    original_filename: str,
    metadata: dict = None,
    layers: list = None
) -> HecRasProject:
    """
    Создаёт новую запись HecRasProject и возвращает её.
    """
    proj = HecRasProject(
        name=name,
        filepath=filepath,
        original_filename=original_filename,
        owner_id=owner_id,
        project_metadata=metadata,
        layers=layers
    )
    db.add(proj)
    db.commit()
    db.refresh(proj)
    return proj

def delete_hecras_project(db: Session, project_id: int, owner_id: int) -> bool:
    """
    Удаляет проект HEC-RAS по ID (только если он принадлежит пользователю).
    Возвращает True при успехе, False если проект не найден.
    """
    project = get_hecras_project(db, project_id, owner_id)
    if not project:
        return False
    db.delete(project)
    db.commit()
    return True

def update_hecras_project_name(
    db: Session,
    project_id: int,
    owner_id: int,
    new_name: str,
    new_filepath: str = None
) -> HecRasProject:
    """
    Переименовывает проект HEC-RAS.
    Возвращает обновлённый проект или None, если проект не найден.
    """
    project = get_hecras_project(db, project_id, owner_id)
    if not project:
        return None
    project.name = new_name
    if new_filepath:
        project.filepath = new_filepath
    db.commit()
    db.refresh(project)
    return project

def get_or_create_share_hash(
    db: Session,
    project_id: int,
    owner_id: int
) -> str:
    """
    Генерирует или возвращает существующий share_hash для проекта.
    Возвращает share_hash или None, если проект не найден.
    """
    project = get_hecras_project(db, project_id, owner_id)
    if not project:
        return None
    
    # Если share_hash уже существует, возвращаем его
    if project.share_hash:
        return project.share_hash
    
    # Генерируем новый уникальный share_hash
    while True:
        share_hash = secrets.token_urlsafe(16)  # Генерируем случайную строку
        # Проверяем, что такой hash не существует
        existing = db.query(HecRasProject).filter(HecRasProject.share_hash == share_hash).first()
        if not existing:
            project.share_hash = share_hash
            db.commit()
            db.refresh(project)
            return share_hash

def regenerate_share_hash(
    db: Session,
    project_id: int,
    owner_id: int
) -> str:
    """
    Всегда генерирует новый share_hash для проекта (даже если уже существует).
    Возвращает новый share_hash или None, если проект не найден.
    """
    project = get_hecras_project(db, project_id, owner_id)
    if not project:
        return None
    
    # Всегда генерируем новый уникальный share_hash
    while True:
        share_hash = secrets.token_urlsafe(16)  # Генерируем случайную строку
        # Проверяем, что такой hash не существует
        existing = db.query(HecRasProject).filter(HecRasProject.share_hash == share_hash).first()
        if not existing:
            project.share_hash = share_hash
            db.commit()
            db.refresh(project)
            return share_hash

def get_project_by_share_hash(
    db: Session,
    share_hash: str
) -> HecRasProject:
    """
    Возвращает проект по share_hash (публичный доступ, без проверки owner_id).
    Возвращает проект или None, если не найден.
    """
    return (
        db.query(HecRasProject)
          .filter(HecRasProject.share_hash == share_hash)
          .first()
    )

def delete_share_hash(
    db: Session,
    project_id: int,
    owner_id: int
) -> bool:
    """
    Удаляет share_hash и share_password для проекта.
    Возвращает True если успешно, False если проект не найден.
    """
    project = get_hecras_project(db, project_id, owner_id)
    if not project:
        return False
    
    project.share_hash = None
    project.share_password = None
    db.commit()
    db.refresh(project)
    return True

def set_share_password(
    db: Session,
    project_id: int,
    owner_id: int,
    password: str
) -> bool:
    """
    Устанавливает пароль для share_hash проекта.
    Пароль будет захеширован перед сохранением.
    Возвращает True если успешно, False если проект не найден.
    """
    from database.security import hash_password
    
    project = get_hecras_project(db, project_id, owner_id)
    if not project:
        return False
    
    # Хешируем пароль перед сохранением
    hashed_password = hash_password(password)
    project.share_password = hashed_password
    db.commit()
    db.refresh(project)
    return True

def remove_share_password(
    db: Session,
    project_id: int,
    owner_id: int
) -> bool:
    """
    Удаляет пароль для share_hash проекта.
    Возвращает True если успешно, False если проект не найден.
    """
    project = get_hecras_project(db, project_id, owner_id)
    if not project:
        return False
    
    project.share_password = None
    db.commit()
    db.refresh(project)
    return True

def verify_share_password(
    db: Session,
    share_hash: str,
    password: str
) -> bool:
    """
    Проверяет пароль для доступа к проекту по share_hash.
    Возвращает True если пароль верный или пароль не установлен, False если неверный.
    """
    from database.security import verify_password
    
    project = get_project_by_share_hash(db, share_hash)
    if not project:
        return False
    
    # Если пароль не установлен, доступ разрешен
    if not project.share_password:
        return True
    
    # Проверяем пароль
    return verify_password(password, project.share_password)

# ============= Функции для пользовательских слоев =============

def create_custom_layer(
    db: Session,
    name: str,
    owner_id: int,
    geojson_data: str,
    fill_color: str = None,
    line_color: str = None
) -> CustomLayer:
    """
    Создаёт новый пользовательский слой и возвращает его.
    Проверяет уникальность имени слоя для данного пользователя.
    """
    # Проверяем, существует ли уже слой с таким именем у этого пользователя
    existing_layer = (
        db.query(CustomLayer)
        .filter(
            CustomLayer.name == name,
            CustomLayer.owner_id == owner_id
        )
        .first()
    )
    
    if existing_layer:
        raise ValueError(f"Слой с именем '{name}' уже существует")
    
    layer = CustomLayer(
        name=name,
        owner_id=owner_id,
        geojson_data=geojson_data,
        fill_color=fill_color,
        line_color=line_color
    )
    db.add(layer)
    db.commit()
    db.refresh(layer)
    return layer

def list_custom_layers(db: Session, owner_id: int):
    """
    Возвращает все пользовательские слои этого пользователя.
    """
    return (
        db.query(CustomLayer)
          .filter(CustomLayer.owner_id == owner_id)
          .order_by(CustomLayer.created_at.desc())
          .all()
    )

def get_custom_layer(db: Session, layer_id: int, owner_id: int):
    """
    Возвращает один пользовательский слой (или None).
    """
    return (
        db.query(CustomLayer)
          .filter(
             CustomLayer.id == layer_id,
             CustomLayer.owner_id == owner_id
          )
          .first()
    )

def update_custom_layer(
    db: Session,
    layer_id: int,
    owner_id: int,
    name: str = None,
    geojson_data: str = None,
    fill_color: str = None,
    line_color: str = None
) -> CustomLayer:
    """
    Обновляет пользовательский слой по ID (только если он принадлежит пользователю).
    Возвращает обновленный слой или None, если слой не найден.
    """
    layer = get_custom_layer(db, layer_id, owner_id)
    if not layer:
        return None
    
    if name is not None:
        layer.name = name
    if geojson_data is not None:
        layer.geojson_data = geojson_data
    if fill_color is not None:
        layer.fill_color = fill_color
    if line_color is not None:
        layer.line_color = line_color
    
    db.commit()
    db.refresh(layer)
    return layer

def delete_custom_layer(db: Session, layer_id: int, owner_id: int) -> bool:
    """
    Удаляет пользовательский слой по ID (только если он принадлежит пользователю).
    Возвращает True при успехе, False если слой не найден.
    """
    layer = get_custom_layer(db, layer_id, owner_id)
    if not layer:
        return False
    db.delete(layer)
    db.commit()
    return True

# ============= Функции для flood проектов =============

def create_flood_project(
    db: Session,
    owner_id: int,
    name: str = None,
    project_id: int = None
) -> FloodProject:
    """
    Создаёт новый flood проект и возвращает его.
    Если указан project_id, использует его как ID (для соответствия с проектом в памяти).
    """
    project = FloodProject(
        id=project_id,
        owner_id=owner_id,
        name=name
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project

def list_flood_projects_by_owner(db: Session, owner_id: int):
    """
    Возвращает все flood-проекты пользователя из БД (только те, что были сохранены через share).
    """
    return (
        db.query(FloodProject)
          .filter(FloodProject.owner_id == owner_id)
          .order_by(FloodProject.created_at.desc())
          .all()
    )

def get_flood_project(db: Session, project_id: int, owner_id: int = None):
    """
    Возвращает flood проект по ID.
    Если указан owner_id, проверяет принадлежность.
    """
    query = db.query(FloodProject).filter(FloodProject.id == project_id)
    if owner_id is not None:
        query = query.filter(FloodProject.owner_id == owner_id)
    return query.first()

def get_flood_project_by_share_hash(db: Session, share_hash: str):
    """
    Возвращает flood проект по share_hash (публичный доступ).
    """
    return db.query(FloodProject).filter(FloodProject.share_hash == share_hash).first()

def update_flood_project_share(
    db: Session,
    project_id: int,
    owner_id: int,
    simulation_data: dict = None,
    files_data: list = None,
    regenerate: bool = False
) -> str:
    """
    Обновляет или создаёт share_hash для flood проекта.
    Сохраняет simulation_data и files_data.
    Возвращает share_hash.
    """
    project = get_flood_project(db, project_id, owner_id)
    if not project:
        return None
    
    # Обновляем данные
    if simulation_data is not None:
        project.simulation_data = simulation_data
    if files_data is not None:
        project.files_data = files_data
    
    # Генерируем share_hash если нужно
    if regenerate or not project.share_hash:
        while True:
            share_hash = secrets.token_urlsafe(16)
            existing = db.query(FloodProject).filter(FloodProject.share_hash == share_hash).first()
            if not existing:
                project.share_hash = share_hash
                break
    
    db.commit()
    db.refresh(project)
    return project.share_hash