# backend/database/routers/auth.py

from typing import Annotated
import os
import secrets
import logging
from pathlib import Path

# ИСПРАВЛЕННЫЙ ИМПОРТ:
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt

# Важно: импортируем вашу Pydantic-схему UserLogin
from database.schemas import (
    UserCreate, UserLogin, UserOut, TokenOut,
    ForgotPasswordRequest, ResetPasswordRequest, MessageResponse,
    UpdateEmailRequest, UpdatePasswordRequest,
    RequestEmailChangeRequest, VerifyEmailChangeRequest,
    UpdateMapSettingsRequest
)
from database.database import get_db
from database import crud
from database.security import SECRET_KEY, ALGORITHM, verify_password, create_access_token
from database.models.user import User
from database.file_paths import AVATARS_DIR, get_avatar_path
from database.email_service import send_verification_email, send_password_reset_email, send_email_change_code, smtp_diagnose
from database.user_verification_tasks import schedule_user_verification, cancel_user_verification

router = APIRouter()
# Используем auto_error=True, чтобы FastAPI правильно обрабатывал отсутствие токена
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """
    Возвращает текущего авторизованного пользователя.
    Используется в других endpoints.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Логируем получение токена (oauth2_scheme уже проверил наличие токена)
    logging.info(f"get_current_user: получен токен от oauth2_scheme, длина: {len(token)}, префикс: {token[:30]}...")
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            logging.warning("get_current_user: username отсутствует в payload")
            raise credentials_exception
        
        logging.info(f"get_current_user: username из токена: {username}")
    except JWTError as e:
        logging.error(f"get_current_user: ошибка декодирования JWT: {type(e).__name__}: {str(e)}")
        raise credentials_exception

    user = crud.get_user_by_username(db, username=username)
    if user is None:
        logging.warning(f"get_current_user: пользователь {username} не найден в БД")
        raise credentials_exception
    
    logging.info(f"get_current_user: успешно авторизован пользователь {username}")
    return user

@router.post(
    "/register",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Регистрация нового пользователя",
    description="Создает новую учетную запись пользователя. Отправляет email с подтверждением для верификации аккаунта."
)
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user_by_username = crud.get_user_by_username(db, username=user.username)
    if db_user_by_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    db_user_by_email = crud.get_user_by_email(db, email=user.email)
    if db_user_by_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    db_user = crud.create_user(db=db, user=user)
    
    # Отправляем email подтверждения
    if db_user.verification_token:
        user_lang = getattr(db_user, 'language', 'ru') or 'ru'
        send_verification_email(
            email=db_user.email,
            username=db_user.username,
            token=db_user.verification_token,
            lang=user_lang
        )
    
    # Запускаем индивидуальную задачу проверки пользователя
    # Проверяет каждую минуту в течение 10 минут после регистрации
    schedule_user_verification(db_user.id, db_user.created)
    
    return {"message": "Registration successful. Please check your email to verify your account."}

# ↓↓↓↓↓↓ ИЗМЕНЕНИЯ ЗДЕСЬ ↓↓↓↓↓↓
@router.post(
    "/login",
    response_model=TokenOut,
    summary="Вход в систему",
    description="Аутентифицирует пользователя по имени пользователя и паролю. Возвращает JWT токен для доступа к защищенным эндпоинтам. Требует подтвержденный email."
)
def login(
    # Для документации FastAPI будет использовать схему UserLogin.
    # Для реальной работы эндпоинта - зависимость OAuth2PasswordRequestForm.
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db)
):
    # Логика остается той же, что и раньше
    user = crud.get_user_by_username(db, form_data.username)
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Проверяем, подтвержден ли email
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in",
        )
    
    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}
# ↑↑↑↑↑↑ ИЗМЕНЕНИЯ ЗДЕСЬ ↑↑↑↑↑↑

@router.get(
    "/users/me",
    response_model=UserOut,
    summary="Получить информацию о текущем пользователе",
    description="Возвращает полную информацию о текущем авторизованном пользователе, включая имя, email, аватар и настройки карты."
)
def get_current_user_info(user: User = Depends(get_current_user)):
    """
    Возвращает информацию о текущем пользователе.
    """
    try:
        # Явно создаем словарь с нужными полями, чтобы избежать проблем с сериализацией relationships
        return UserOut(
            id=user.id,
            username=user.username,
            email=user.email,
            avatar_url=user.avatar_url,
            default_map_style=user.default_map_style,
            default_map_projection=user.default_map_projection
        )
    except Exception as e:
        logging.exception(f"Error serializing user data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving user information: {str(e)}"
        )

@router.get(
    "/verify-email",
    response_model=MessageResponse,
    summary="Подтверждение email",
    description="Подтверждает email пользователя по токену, полученному в письме. Активирует учетную запись для входа в систему."
)
def verify_email(token: str, db: Session = Depends(get_db)):
    """
    Подтверждает email пользователя по токену.
    """
    user = crud.get_user_by_verification_token(db, token)
    
    # Если токен не найден, возможно email уже был подтвержден (токен удален)
    # В этом случае возвращаем успех, чтобы не показывать ошибку пользователю
    if not user:
        # Токен не найден - возможно уже был использован
        # Возвращаем успех, чтобы фронтенд не показывал ошибку
        return {"message": "Email already verified"}
    
    # Если email уже подтвержден, возвращаем успех
    if user.is_verified:
        return {"message": "Email already verified"}
    
    # Подтверждаем email
    if crud.verify_user_email(db, token):
        # Отменяем задачу проверки, так как пользователь подтвердил email
        cancel_user_verification(user.id)
        return {"message": "Email verified successfully"}
    
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired verification token"
    )

@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Запрос на восстановление пароля",
    description="Отправляет email с ссылкой для сброса пароля. Если email не найден, возвращает успешный ответ для безопасности (не раскрывает существование пользователя)."
)
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Отправляет email для восстановления пароля.
    """
    user = crud.get_user_by_email(db, request.email)
    if not user:
        # Для безопасности не сообщаем, существует ли пользователь
        return {"message": "If the email exists, a password reset link has been sent"}
    
    reset_token = crud.set_password_reset_token(db, request.email)
    if reset_token:
        user_lang = getattr(user, 'language', 'ru') or 'ru'
        send_password_reset_email(
            email=user.email,
            username=user.username,
            token=reset_token,
            lang=user_lang
        )
    
    return {"message": "If the email exists, a password reset link has been sent"}

@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Сброс пароля",
    description="Сбрасывает пароль пользователя по токену, полученному в email. Токен действителен ограниченное время."
)
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Сбрасывает пароль пользователя по токену.
    """
    if crud.reset_user_password(db, request.token, request.new_password):
        return {"message": "Password reset successfully"}
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired reset token"
    )

@router.get(
    "/test-email",
    tags=["Email Diagnostics"],
    summary="Тестирование SMTP конфигурации",
    description="Диагностический endpoint для проверки SMTP настроек и подключения. Выполняет полную диагностику конфигурации email сервера и возвращает детальный отчет."
)
def test_email_config():
    """
    Диагностический endpoint для проверки SMTP настроек и подключения.
    Выполняет полную диагностику SMTP конфигурации.
    """
    results = smtp_diagnose()
    return results

@router.post(
    "/users/me/email/request",
    response_model=MessageResponse,
    summary="Запрос на изменение email",
    description="Запрашивает изменение email адреса. Отправляет код подтверждения на новый email адрес. Требует подтверждения через /users/me/email/verify."
)
def request_email_change(
    request: RequestEmailChangeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Запрашивает изменение email. Отправляет код подтверждения на новый email.
    """
    # Проверяем, не занят ли email другим пользователем
    existing_user = crud.get_user_by_email(db, request.new_email)
    if existing_user and existing_user.id != user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Проверяем, не совпадает ли новый email с текущим
    if user.email == request.new_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New email is the same as current email"
        )
    
    # Генерируем код и сохраняем новый email во временное поле
    code = crud.request_email_change(db, user.id, request.new_email)
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to request email change"
        )
    
    # Отправляем код на новый email
    user_lang = getattr(user, 'language', 'ru') or 'ru'
    send_email_change_code(
        email=request.new_email,
        username=user.username,
        code=code,
        lang=user_lang
    )
    
    return {"message": "Verification code sent to new email address"}

@router.post(
    "/users/me/email/verify",
    response_model=MessageResponse,
    summary="Подтверждение изменения email",
    description="Подтверждает изменение email адреса по коду, полученному в письме. Обновляет email пользователя и отправляет письмо подтверждения на новый адрес."
)
def verify_email_change(
    request: VerifyEmailChangeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Подтверждает изменение email по коду. Обновляет email пользователя.
    """
    if crud.verify_email_change_code(db, user.id, request.code):
        # После успешного изменения email отправляем письмо подтверждения на новый email
        updated_user = crud.get_user_by_username(db, user.username)
        if updated_user and updated_user.verification_token:
            user_lang = getattr(updated_user, 'language', 'ru') or 'ru'
            send_verification_email(
                email=updated_user.email,
                username=updated_user.username,
                token=updated_user.verification_token,
                lang=user_lang
            )
        return {"message": "Email updated successfully. Please verify your new email."}
    
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired verification code"
    )

@router.put(
    "/users/me/email",
    response_model=MessageResponse,
    summary="Обновление email (устаревший метод)",
    description="УСТАРЕВШИЙ ENDPOINT - оставлен для обратной совместимости. Обновляет email пользователя и отправляет письмо подтверждения. Рекомендуется использовать /users/me/email/request и /users/me/email/verify вместо этого."
)
def update_email(
    request: UpdateEmailRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Обновляет email пользователя и отправляет письмо подтверждения.
    УСТАРЕВШИЙ ENDPOINT - оставлен для обратной совместимости.
    Используйте /users/me/email/request и /users/me/email/verify вместо этого.
    """
    # Проверяем, не занят ли email другим пользователем
    existing_user = crud.get_user_by_email(db, request.new_email)
    if existing_user and existing_user.id != user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Обновляем email и создаем новый токен подтверждения
    if crud.update_user_email(db, user.id, request.new_email):
        # Отправляем письмо подтверждения на новый email
        updated_user = crud.get_user_by_username(db, user.username)
        if updated_user and updated_user.verification_token:
            user_lang = getattr(updated_user, 'language', 'ru') or 'ru'
            send_verification_email(
                email=updated_user.email,
                username=updated_user.username,
                token=updated_user.verification_token,
                lang=user_lang
            )
        return {"message": "Email updated. Please check your new email to verify it."}
    
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Failed to update email"
    )

@router.put(
    "/users/me/password",
    response_model=MessageResponse,
    summary="Изменение пароля",
    description="Обновляет пароль текущего пользователя. Требует указания текущего пароля для подтверждения безопасности."
)
def update_password(
    request: UpdatePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Обновляет пароль пользователя. Требует текущий пароль для подтверждения.
    """
    # Проверяем текущий пароль
    if not verify_password(request.current_password, user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Обновляем пароль
    if crud.update_user_password(db, user.id, request.new_password):
        return {"message": "Password updated successfully"}
    
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Failed to update password"
    )

@router.post(
    "/users/me/avatar",
    response_model=MessageResponse,
    summary="Загрузка аватара",
    description="Загружает изображение аватара для текущего пользователя. Поддерживаемые форматы: JPG, JPEG, PNG, GIF, WEBP. Файл сохраняется на сервере и доступен по URL."
)
def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Загружает аватар пользователя.
    """
    # Проверяем тип файла
    allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Генерируем уникальное имя файла
    file_extension = Path(file.filename).suffix
    unique_filename = f"{user.id}_{secrets.token_urlsafe(8)}{file_extension}"
    file_path = get_avatar_path(unique_filename)
    
    # Сохраняем файл
    try:
        with open(file_path, "wb") as buffer:
            content = file.file.read()
            buffer.write(content)
        
        # Сохраняем относительный путь в БД
        avatar_url = f"/api/avatars/{unique_filename}"
        if crud.update_user_avatar(db, user.id, avatar_url):
            return {"message": "Avatar uploaded successfully"}
        
        # Если не удалось сохранить в БД, удаляем файл
        if file_path.exists():
            file_path.unlink()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save avatar"
        )
    except Exception as e:
        # Удаляем файл в случае ошибки
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload avatar: {str(e)}"
        )

@router.delete(
    "/users/me/avatar",
    response_model=MessageResponse,
    summary="Удаление аватара",
    description="Удаляет аватар текущего пользователя. Удаляет как файл с сервера, так и запись из базы данных."
)
def delete_avatar(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Удаляет аватар пользователя.
    """
    # Удаляем файл, если он существует
    if user.avatar_url:
        # Извлекаем имя файла из URL
        filename = user.avatar_url.split('/')[-1]
        file_path = get_avatar_path(filename)
        if file_path.exists():
            try:
                file_path.unlink()
            except Exception:
                pass  # Игнорируем ошибки при удалении файла
    
    # Удаляем запись из БД
    if crud.delete_user_avatar(db, user.id):
        return {"message": "Avatar deleted successfully"}
    
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Failed to delete avatar"
    )

@router.put(
    "/users/me/map-settings",
    response_model=MessageResponse,
    summary="Обновление настроек карты",
    description="Обновляет настройки карты пользователя: стиль карты (map_style) и проекцию (map_projection). Эти настройки используются по умолчанию при открытии карты."
)
def update_map_settings(
    request: UpdateMapSettingsRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Обновляет настройки карты пользователя (стиль и проекция).
    """
    if crud.update_user_map_settings(db, user.id, request.map_style, request.map_projection):
        return {"message": "Map settings updated successfully"}
    
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Failed to update map settings"
    )

@router.post(
    "/admin/cleanup-unverified-users",
    response_model=MessageResponse,
    tags=["Admin"],
    summary="Очистка неподтвержденных пользователей",
    description="Ручная очистка неподтвержденных пользователей старше указанного количества минут. Полезно для тестирования и ручной очистки базы данных. Удаляет пользователей, которые не подтвердили email в течение указанного времени."
)
def cleanup_unverified_users(
    minutes: int = 10,
    db: Session = Depends(get_db)
):
    """
    Ручная очистка неподтвержденных пользователей старше указанного количества минут.
    Полезно для тестирования и ручной очистки.
    """
    deleted_count = crud.delete_unverified_users_older_than(db, minutes=minutes)
    return {
        "message": f"Cleanup completed. Deleted {deleted_count} unverified users older than {minutes} minutes."
    }