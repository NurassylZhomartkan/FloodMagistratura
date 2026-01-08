# SMTP Email Testing Guide

## Быстрый тест

### 1. Диагностический endpoint

Вызовите диагностический endpoint для проверки SMTP настроек:

```bash
GET http://127.0.0.1:8000/auth/test-email
```

Или через браузер:
```
http://127.0.0.1:8000/auth/test-email
```

Этот endpoint выполнит:
- Проверку загрузки .env файла
- Проверку TCP подключения к SMTP серверу
- Попытку SSL handshake с TLS 1.2
- Попытку аутентификации
- Выведет подробные логи всех шагов

### 2. Тест отправки email через регистрацию

```bash
POST http://127.0.0.1:8000/auth/register
Content-Type: application/json

{
  "username": "testuser",
  "email": "your-test-email@example.com",
  "password": "testpass123"
}
```

## Чеклист проверки

### ✅ Базовая конфигурация

- [ ] Файл `.env` существует в `backend/.env`
- [ ] Переменные загружены (проверьте логи при старте сервера)
- [ ] `SMTP_USER` содержит полный email адрес (например: `flood@nurassyl.ru`)
- [ ] `SMTP_PASSWORD` установлен
- [ ] `SMTP_HOST` правильный (например: `nurassyl.ru` или `mail.nurassyl.ru`)
- [ ] `SMTP_PORT` = 465 для SSL или 587 для STARTTLS

### ✅ Сетевая доступность

- [ ] TCP порт доступен (проверяется в `/auth/test-email`)
- [ ] Нет блокировки файрволом
- [ ] Антивирус не блокирует исходящие соединения

### ✅ SSL/TLS соединение

- [ ] SSL handshake успешен (TLS 1.2)
- [ ] Сертификат сервера принят (или отключена проверка для тестирования)

### ✅ Аутентификация

- [ ] Username правильный (должен быть `flood@nurassyl.ru`, НЕ `flood@nurassyl.ru@nurassyl.ru`)
- [ ] Пароль правильный
- [ ] Учетные данные соответствуют SMTP серверу

## Типичные ошибки и их значения

### 1. `[SSL: UNEXPECTED_EOF_WHILE_READING]`

**Причина**: Сервер закрыл SSL соединение неожиданно.

**Возможные решения**:
- Проверьте, что порт 465 действительно использует implicit TLS (не STARTTLS)
- Попробуйте альтернативный хост (`mail.nurassyl.ru` вместо `nurassyl.ru`)
- Проверьте настройки файрвола/антивируса
- Убедитесь, что используется TLS 1.2 (уже настроено в коде)

### 2. `Connection unexpectedly closed`

**Причина**: Сервер закрыл соединение до завершения handshake.

**Возможные решения**:
- Проверьте доступность порта через TCP
- Убедитесь, что SMTP сервер работает
- Проверьте логи SMTP сервера (если есть доступ)

### 3. `SMTPAuthenticationError: (535, 'Username and Password not accepted')`

**Причина**: Неправильные учетные данные.

**Возможные решения**:
- Проверьте правильность `SMTP_USER` (должен быть полный email: `flood@nurassyl.ru`)
- Проверьте правильность `SMTP_PASSWORD`
- Убедитесь, что username НЕ искажен (не должно быть `user@host@host`)
- Для Gmail: используйте пароль приложения, а не обычный пароль

### 4. `socket.timeout` или `socket.gaierror`

**Причина**: Проблемы с сетью или DNS.

**Возможные решения**:
- Проверьте доступность хоста: `ping nurassyl.ru`
- Проверьте DNS разрешение: `nslookup nurassyl.ru`
- Проверьте настройки файрвола
- Убедитесь, что порт не заблокирован

### 5. `SMTP_USER` искажен (например: `flood@nurassyl.ru@nurassyl.ru`)

**Причина**: Код неправильно формирует username.

**Решение**: Уже исправлено в коде. Username теперь используется напрямую из `.env` без изменений.

## Проверка логов

При запуске сервера проверьте логи:

```
[EMAIL SERVICE] Loaded .env from: /path/to/backend/.env
[EMAIL SERVICE] SMTP config - HOST: nurassyl.ru, PORT: 465, USER: flood@nurassyl.ru, PASSWORD: *********
[EMAIL SERVICE] SMTP configured successfully: USER=flood@nurassyl.ru, HOST=nurassyl.ru, PORT=465
```

**Важно**: В логе должно быть `USER=flood@nurassyl.ru`, а НЕ `flood@nurassyl.ru@nurassyl.ru`.

## Ручной тест через Python

Если нужно протестировать напрямую:

```python
from backend.database.email_service import smtp_diagnose
results = smtp_diagnose()
print(results)
```

## Контакты для поддержки

Если проблема не решается:
1. Проверьте логи диагностики (`/auth/test-email`)
2. Проверьте настройки SMTP у провайдера почты
3. Убедитесь, что SMTP сервер поддерживает TLS 1.2
4. Проверьте, что порт 465 действительно использует implicit TLS


