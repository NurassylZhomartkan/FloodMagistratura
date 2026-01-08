# Настройка Email для подтверждения регистрации и восстановления пароля

## Быстрая настройка (рекомендуется)

Создайте файл `.env` в папке `backend` со следующим содержимым:

```env
# SMTP настройки для отправки email
SMTP_HOST=nurassyl.ru
SMTP_PORT=465
SMTP_USER=flood@nurassyl.ru
SMTP_PASSWORD=u_J580fe2
SMTP_FROM_EMAIL=flood@nurassyl.ru
FRONTEND_URL=http://127.0.0.1:5173
```

**Важно**: Убедитесь, что файл `.env` добавлен в `.gitignore` и не попадает в систему контроля версий!

## Установка python-dotenv

Пакет `python-dotenv` уже установлен. Если нужно установить вручную:

```bash
cd backend
python -m pip install python-dotenv
```

## Переменные окружения (альтернативный способ)

Если вы не хотите использовать `.env` файл, можно настроить переменные окружения напрямую:

```bash
# SMTP настройки
SMTP_HOST=nurassyl.ru
SMTP_PORT=465
SMTP_USER=flood@nurassyl.ru
SMTP_PASSWORD=u_J580fe2
SMTP_FROM_EMAIL=flood@nurassyl.ru
FRONTEND_URL=http://127.0.0.1:5173
```

## Настройка Gmail

1. Включите двухфакторную аутентификацию в вашем Google аккаунте
2. Создайте пароль приложения:
   - Перейдите в [Настройки аккаунта Google](https://myaccount.google.com/)
   - Безопасность → Двухэтапная аутентификация → Пароли приложений
   - Создайте новый пароль приложения для "Почта"
   - Используйте этот пароль в `SMTP_PASSWORD`

## Настройка других почтовых сервисов

### Yandex Mail
```
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_USER=your-email@yandex.ru
SMTP_PASSWORD=your-password
```

### Mail.ru
```
SMTP_HOST=smtp.mail.ru
SMTP_PORT=465
SMTP_USER=your-email@mail.ru
SMTP_PASSWORD=your-password
```

## Установка переменных окружения

### Windows (PowerShell)
```powershell
$env:SMTP_HOST="smtp.gmail.com"
$env:SMTP_PORT="587"
$env:SMTP_USER="your-email@gmail.com"
$env:SMTP_PASSWORD="your-app-password"
$env:SMTP_FROM_EMAIL="your-email@gmail.com"
$env:FRONTEND_URL="http://127.0.0.1:5173"
```

### Linux/Mac
```bash
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your-email@gmail.com
export SMTP_PASSWORD=your-app-password
export SMTP_FROM_EMAIL=your-email@gmail.com
export FRONTEND_URL=http://127.0.0.1:5173
```

## Примечание

- Если SMTP не настроен, система будет выводить содержимое писем в консоль вместо отправки. Это полезно для разработки и тестирования.
- Порт 465 использует SSL соединение напрямую (SMTP_SSL), порт 587 использует STARTTLS.
- После создания `.env` файла перезапустите сервер FastAPI для применения настроек.

## Миграция базы данных

После обновления модели User необходимо создать миграцию:

```bash
cd backend
alembic revision --autogenerate -m "add_email_verification_fields"
alembic upgrade head
```

Или если используется SQLite/PostgreSQL с автоматическим созданием таблиц, таблицы будут созданы автоматически при первом запуске.

