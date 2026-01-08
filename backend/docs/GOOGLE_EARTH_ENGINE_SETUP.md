# Настройка Google Earth Engine для загрузки данных WorldCover

## Обзор

Для загрузки данных WorldCover (Sentinel-2 based, 10 meter resolution) используется Google Earth Engine API. Существует два способа настройки:

1. **Сервисный аккаунт (рекомендуется для production)** - использует JSON файл с credentials
2. **Интерактивная аутентификация (для разработки)** - требует однократного выполнения команды

## Способ 1: Сервисный аккаунт (рекомендуется)

### Шаг 1: Создание сервисного аккаунта

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Выберите или создайте проект
3. Перейдите в **IAM & Admin** → **Service Accounts**
4. Нажмите **Create Service Account**
5. Заполните данные:
   - **Service account name**: `earth-engine-service`
   - **Service account ID**: автоматически сгенерируется
6. Нажмите **Create and Continue**
7. В разделе **Grant this service account access to project** добавьте роль:
   - **Earth Engine User** (или **Editor** для полного доступа)
8. Нажмите **Continue** → **Done**

### Шаг 2: Создание и скачивание JSON ключа

1. Найдите созданный сервисный аккаунт в списке
2. Нажмите на email сервисного аккаунта
3. Перейдите на вкладку **Keys**
4. Нажмите **Add Key** → **Create new key**
5. Выберите тип **JSON**
6. Нажмите **Create** - файл автоматически скачается

### Шаг 3: Регистрация сервисного аккаунта в Google Earth Engine

1. Перейдите на [Google Earth Engine](https://earthengine.google.com/)
2. Войдите с аккаунтом, который имеет доступ к проекту
3. Перейдите в **Settings** → **Service Accounts**
4. Добавьте email вашего сервисного аккаунта
5. Подтвердите регистрацию

### Шаг 4: Настройка в проекте

1. Сохраните скачанный JSON файл в безопасном месте (например, `backend/credentials/gee-service-account.json`)
2. Добавьте путь к файлу в `.env` файл:

```env
GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT_JSON=backend/credentials/gee-service-account.json
```

**Важно**: Убедитесь, что файл JSON добавлен в `.gitignore` и не попадает в систему контроля версий!

### Пример .env файла:

```env
SMTP_HOST=nurassyl.ru
SMTP_PORT=465
SMTP_USER=flood@nurassyl.ru
SMTP_PASSWORD=u_J580fe2
SMTP_FROM_EMAIL=flood@nurassyl.ru
FRONTEND_URL=http://127.0.0.1:5173
GOOGLE_OAUTH_CLIENT_ID=572928965759-9crb6mrt67ko5locdkdp8q9jk7hveomf.apps.googleusercontent.com
GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT_JSON=backend/credentials/gee-service-account.json
```

## Способ 2: Интерактивная аутентификация (для разработки)

### Шаг 1: Установка earthengine-api

```bash
cd backend
pip install earthengine-api
```

### Шаг 2: Аутентификация

Выполните один раз в командной строке:

```bash
earthengine authenticate
```

Или в Python:

```python
import ee
ee.Authenticate()
ee.Initialize()
```

Это создаст файл credentials в вашем домашнем каталоге, который будет использоваться автоматически.

**Примечание**: Этот способ подходит только для разработки на локальной машине. Для production сервера используйте сервисный аккаунт.

## Проверка настройки

После настройки перезапустите FastAPI сервер и попробуйте загрузить данные WorldCover через интерфейс приложения.

Если настройка выполнена правильно, данные должны загружаться без ошибок аутентификации.

## Устранение проблем

### Ошибка: "Please authorize access to your Earth Engine account"

**Решение**: 
- Для production: используйте сервисный аккаунт (Способ 1)
- Для разработки: выполните `earthengine authenticate`

### Ошибка: "Service account file not found"

**Решение**: 
- Проверьте путь к JSON файлу в `.env`
- Убедитесь, что путь указан относительно корня проекта или используйте абсолютный путь
- Проверьте права доступа к файлу

### Ошибка: "Permission denied"

**Решение**:
- Убедитесь, что сервисный аккаунт зарегистрирован в Google Earth Engine
- Проверьте, что сервисному аккаунту назначена роль **Earth Engine User**
- Убедитесь, что проект активирован в Google Earth Engine

## Дополнительные ресурсы

- [Google Earth Engine Documentation](https://developers.google.com/earth-engine)
- [Service Account Setup Guide](https://developers.google.com/earth-engine/guides/service_account)
- [Earth Engine API Python Client](https://github.com/google/earthengine-api)











