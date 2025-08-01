# backend/database/crud.py

from sqlalchemy.orm import Session
from database.models.hec_ras import HecRasProject
from database.models.user import User
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
    Создаёт нового пользователя с хэшированным паролем.
    """
    # ИСПРАВЛЕННЫЙ ВЫЗОВ ФУНКЦИИ:
    hashed_password = hash_password(user.password)
    db_user = User(username=user.username, email=user.email, password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

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
    original_filename: str
) -> HecRasProject:
    """
    Создаёт новую запись HecRasProject и возвращает её.
    """
    proj = HecRasProject(
        name=name,
        filepath=filepath,
        original_filename=original_filename,
        owner_id=owner_id
    )
    db.add(proj)
    db.commit()
    db.refresh(proj)
    return proj