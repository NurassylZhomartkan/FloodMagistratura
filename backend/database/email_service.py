# backend/database/email_service.py

import os
import smtplib
import ssl
import socket
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from dotenv import load_dotenv
from pathlib import Path
from database.email_translations import get_email_translation

# Загружаем переменные окружения из .env файла
# Ищем .env файл в директории backend
backend_dir = Path(__file__).parent.parent
env_path = backend_dir / '.env'

# Пробуем загрузить .env из разных мест
loaded = False
if env_path.exists():
    load_dotenv(dotenv_path=env_path, override=True)
    loaded = True
else:
    # Пробуем загрузить из текущей директории
    current_env = Path('.env')
    if current_env.exists():
        load_dotenv(dotenv_path=current_env, override=True)
        loaded = True
    else:
        # Пробуем загрузить из корня проекта (на уровень выше backend)
        root_env = backend_dir.parent / '.env'
        if root_env.exists():
            load_dotenv(dotenv_path=root_env, override=True)
            loaded = True
        else:
            load_dotenv()  # Загружаем из текущей директории по умолчанию

# Настройки SMTP (можно переопределить через переменные окружения)
# Перезагружаем переменные окружения для уверенности
if env_path.exists():
    load_dotenv(dotenv_path=env_path, override=True)
else:
    load_dotenv(override=True)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()  # Убираем пробелы
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()  # Убираем пробелы
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USER).strip()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:5173")

def _create_ssl_context() -> ssl.SSLContext:
    """
    Создает SSL контекст с TLS 1.2 для SMTP соединений.
    """
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    
    # Принудительно используем TLS 1.2
    try:
        # Python 3.7+
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.maximum_version = ssl.TLSVersion.TLSv1_2
    except AttributeError:
        # Для старых версий Python
        context.options |= ssl.OP_NO_SSLv2
        context.options |= ssl.OP_NO_SSLv3
        context.options |= ssl.OP_NO_TLSv1
        context.options |= ssl.OP_NO_TLSv1_1
    
    return context

def _get_alternative_host(base_host: str) -> Optional[str]:
    """
    Возвращает альтернативный хост для проверки.
    Если base_host = nurassyl.ru, возвращает mail.nurassyl.ru и наоборот.
    """
    if base_host == "nurassyl.ru":
        return "mail.nurassyl.ru"
    elif base_host == "mail.nurassyl.ru":
        return "nurassyl.ru"
    return None

def send_email(to_email: str, subject: str, body_html: str, body_text: Optional[str] = None) -> bool:
    """
    Отправляет email через SMTP.
    Возвращает True при успехе, False при ошибке.
    """
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"[EMAIL SERVICE] SMTP не настроен. Пропуск отправки email на {to_email}")
        print(f"[EMAIL SERVICE] Тема: {subject}")
        print(f"[EMAIL SERVICE] Содержимое: {body_text or body_html}")
        return False
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = SMTP_FROM_EMAIL
        msg['To'] = to_email
        
        if body_text:
            part1 = MIMEText(body_text, 'plain', 'utf-8')
            msg.attach(part1)
        
        part2 = MIMEText(body_html, 'html', 'utf-8')
        msg.attach(part2)
        
        # Порт 465 использует SSL напрямую (implicit TLS)
        if SMTP_PORT == 465:
            context = _create_ssl_context()
            # Если SMTP_HOST = nurassyl.ru, используем только mail.nurassyl.ru
            if SMTP_HOST == "nurassyl.ru":
                hosts_to_try = ["mail.nurassyl.ru"]
            else:
                hosts_to_try = [SMTP_HOST]
                alt_host = _get_alternative_host(SMTP_HOST)
                # Не добавляем nurassyl.ru как альтернативу
                if alt_host and alt_host != "nurassyl.ru":
                    hosts_to_try.append(alt_host)
            
            connection_success = False
            last_error = None
            
            for host in hosts_to_try:
                if connection_success:
                    break
                
                try:
                    print(f"[EMAIL SERVICE] Попытка подключения через SMTP_SSL к {host}:{SMTP_PORT}...")
                    with smtplib.SMTP_SSL(host, SMTP_PORT, context=context, timeout=30) as server:
                        server.login(SMTP_USER, SMTP_PASSWORD)  # ИСПРАВЛЕНО: используем SMTP_USER напрямую, без изменений
                        server.send_message(msg)
                    connection_success = True
                    print(f"[EMAIL SERVICE] Email успешно отправлен на {to_email} через {host}:{SMTP_PORT}")
                    break
                except Exception as e:
                    last_error = e
                    print(f"[EMAIL SERVICE] Ошибка подключения к {host}:{SMTP_PORT}: {e}")
            
            if not connection_success:
                raise last_error if last_error else Exception(f"Не удалось установить соединение с {', '.join(hosts_to_try)}")
        elif SMTP_PORT == 25:
            # Порт 25 обычно использует обычное SMTP без SSL/TLS
            print(f"[EMAIL SERVICE] Попытка подключения через обычное SMTP (без SSL) к {SMTP_HOST}:{SMTP_PORT}...")
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
                # Не используем starttls() для порта 25 без SSL
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(msg)
            print(f"[EMAIL SERVICE] Email успешно отправлен на {to_email} через {SMTP_HOST}:{SMTP_PORT} (без SSL)")
        else:
            # STARTTLS для портов 587 и других
            context = _create_ssl_context()
            print(f"[EMAIL SERVICE] Попытка подключения через SMTP с STARTTLS к {SMTP_HOST}:{SMTP_PORT}...")
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
                server.starttls(context=context)
                server.login(SMTP_USER, SMTP_PASSWORD)  # ИСПРАВЛЕНО: используем SMTP_USER напрямую
                server.send_message(msg)
            print(f"[EMAIL SERVICE] Email успешно отправлен на {to_email}")
        
        return True
    except smtplib.SMTPAuthenticationError as e:
        print(f"[EMAIL SERVICE] Ошибка аутентификации SMTP: {e}")
        print(f"[EMAIL SERVICE] Используемые настройки: HOST={SMTP_HOST}, PORT={SMTP_PORT}, USER={SMTP_USER}")
        if "gmail.com" in SMTP_HOST.lower():
            print(f"[EMAIL SERVICE] ПОДСКАЗКА: Для Gmail требуется пароль приложения, а не обычный пароль.")
            print(f"[EMAIL SERVICE] ПОДСКАЗКА: Включите 2FA и создайте пароль приложения: https://myaccount.google.com/apppasswords")
        else:
            print(f"[EMAIL SERVICE] ПОДСКАЗКА: Проверьте правильность пароля для {SMTP_USER}")
        return False
    except (ssl.SSLError, ssl.SSLEOFError) as ssl_error:
        print(f"[EMAIL SERVICE] Ошибка SSL соединения: {ssl_error}")
        print(f"[EMAIL SERVICE] Используемые настройки: HOST={SMTP_HOST}, PORT={SMTP_PORT}, USER={SMTP_USER}")
        print(f"[EMAIL SERVICE] ПОДСКАЗКА: Проблема с SSL/TLS соединением. Проверьте:")
        print(f"[EMAIL SERVICE]   - Правильность SMTP_HOST и PORT")
        print(f"[EMAIL SERVICE]   - Доступность SMTP сервера")
        print(f"[EMAIL SERVICE]   - Настройки файрвола/антивируса")
        return False
    except Exception as e:
        print(f"[EMAIL SERVICE] Ошибка при отправке email: {e}")
        print(f"[EMAIL SERVICE] Тип ошибки: {type(e).__name__}")
        print(f"[EMAIL SERVICE] Используемые настройки: HOST={SMTP_HOST}, PORT={SMTP_PORT}, USER={SMTP_USER}")
        return False

def smtp_diagnose() -> dict:
    """
    Диагностическая функция для проверки SMTP настроек и подключения.
    Возвращает словарь с результатами диагностики.
    """
    results = {
        "env_file": str(env_path) if env_path.exists() else "NOT FOUND",
        "host": SMTP_HOST,
        "port": SMTP_PORT,
        "user": SMTP_USER,
        "password_set": bool(SMTP_PASSWORD),
        "password_length": len(SMTP_PASSWORD) if SMTP_PASSWORD else 0,
        "tcp_connectivity": {},
        "smtp_connection": {},
        "errors": []
    }
    
    print("\n" + "="*60)
    print("[SMTP DIAGNOSTICS] Начало диагностики")
    print("="*60)
    print(f"[SMTP DIAGNOSTICS] .env файл: {results['env_file']}")
    print(f"[SMTP DIAGNOSTICS] SMTP_HOST: {SMTP_HOST}")
    print(f"[SMTP DIAGNOSTICS] SMTP_PORT: {SMTP_PORT}")
    print(f"[SMTP DIAGNOSTICS] SMTP_USER: {SMTP_USER}")
    print(f"[SMTP DIAGNOSTICS] SMTP_PASSWORD: {'*' * results['password_length'] if results['password_set'] else 'NOT SET'}")
    
    # Проверка TCP подключения
    # Если SMTP_HOST = nurassyl.ru, используем только mail.nurassyl.ru
    if SMTP_HOST == "nurassyl.ru":
        hosts_to_check = ["mail.nurassyl.ru"]
    else:
        hosts_to_check = [SMTP_HOST]
        alt_host = _get_alternative_host(SMTP_HOST)
        # Не добавляем nurassyl.ru как альтернативу
        if alt_host and alt_host != "nurassyl.ru":
            hosts_to_check.append(alt_host)
    
    print(f"\n[SMTP DIAGNOSTICS] Проверка TCP подключения к порту {SMTP_PORT}...")
    for host in hosts_to_check:
        try:
            sock = socket.create_connection((host, SMTP_PORT), timeout=5)
            sock.close()
            results["tcp_connectivity"][host] = "OK"
            print(f"[SMTP DIAGNOSTICS] ✓ {host}:{SMTP_PORT} - доступен")
        except socket.timeout:
            results["tcp_connectivity"][host] = "TIMEOUT"
            results["errors"].append(f"TCP timeout для {host}:{SMTP_PORT}")
            print(f"[SMTP DIAGNOSTICS] ✗ {host}:{SMTP_PORT} - timeout")
        except socket.gaierror as e:
            results["tcp_connectivity"][host] = f"DNS_ERROR: {e}"
            results["errors"].append(f"DNS ошибка для {host}: {e}")
            print(f"[SMTP DIAGNOSTICS] ✗ {host}:{SMTP_PORT} - DNS ошибка: {e}")
        except Exception as e:
            results["tcp_connectivity"][host] = f"ERROR: {e}"
            results["errors"].append(f"Ошибка подключения к {host}:{SMTP_PORT}: {e}")
            print(f"[SMTP DIAGNOSTICS] ✗ {host}:{SMTP_PORT} - ошибка: {e}")
    
    # Проверка SMTP подключения с отладкой
    if SMTP_PORT == 465:
        print(f"\n[SMTP DIAGNOSTICS] Попытка SMTP_SSL подключения с TLS 1.2...")
        context = _create_ssl_context()
        
        for host in hosts_to_check:
            if host not in results["tcp_connectivity"] or "OK" not in results["tcp_connectivity"][host]:
                continue
            
            try:
                print(f"[SMTP DIAGNOSTICS] Подключение к {host}:{SMTP_PORT}...")
                server = smtplib.SMTP_SSL(host, SMTP_PORT, context=context, timeout=10)
                server.set_debuglevel(1)  # Включаем отладку
                print(f"[SMTP DIAGNOSTICS] ✓ SSL handshake успешен")
                
                try:
                    print(f"[SMTP DIAGNOSTICS] Попытка аутентификации с USER={SMTP_USER}...")
                    server.login(SMTP_USER, SMTP_PASSWORD)
                    print(f"[SMTP DIAGNOSTICS] ✓ Аутентификация успешна")
                    results["smtp_connection"][host] = "SUCCESS"
                    server.quit()
                except smtplib.SMTPAuthenticationError as e:
                    results["smtp_connection"][host] = f"AUTH_ERROR: {e}"
                    results["errors"].append(f"Ошибка аутентификации на {host}: {e}")
                    print(f"[SMTP DIAGNOSTICS] ✗ Ошибка аутентификации: {e}")
                    server.quit()
                except Exception as e:
                    results["smtp_connection"][host] = f"ERROR: {e}"
                    results["errors"].append(f"Ошибка на {host}: {e}")
                    print(f"[SMTP DIAGNOSTICS] ✗ Ошибка: {e}")
                    try:
                        server.quit()
                    except:
                        pass
            except ssl.SSLError as e:
                results["smtp_connection"][host] = f"SSL_ERROR: {e}"
                results["errors"].append(f"SSL ошибка на {host}: {e}")
                print(f"[SMTP DIAGNOSTICS] ✗ SSL ошибка: {e}")
            except Exception as e:
                results["smtp_connection"][host] = f"ERROR: {e}"
                results["errors"].append(f"Ошибка подключения к {host}: {e}")
                print(f"[SMTP DIAGNOSTICS] ✗ Ошибка подключения: {e}")
    elif SMTP_PORT == 25:
        print(f"\n[SMTP DIAGNOSTICS] Попытка обычного SMTP подключения (без SSL) к порту 25...")
        for host in hosts_to_check:
            if host not in results["tcp_connectivity"] or "OK" not in results["tcp_connectivity"][host]:
                continue
            
            try:
                print(f"[SMTP DIAGNOSTICS] Подключение к {host}:{SMTP_PORT}...")
                server = smtplib.SMTP(host, SMTP_PORT, timeout=10)
                server.set_debuglevel(1)  # Включаем отладку
                print(f"[SMTP DIAGNOSTICS] ✓ SMTP соединение установлено")
                
                try:
                    print(f"[SMTP DIAGNOSTICS] Попытка аутентификации с USER={SMTP_USER}...")
                    server.login(SMTP_USER, SMTP_PASSWORD)
                    print(f"[SMTP DIAGNOSTICS] ✓ Аутентификация успешна")
                    results["smtp_connection"][host] = "SUCCESS"
                    server.quit()
                except smtplib.SMTPAuthenticationError as e:
                    results["smtp_connection"][host] = f"AUTH_ERROR: {e}"
                    results["errors"].append(f"Ошибка аутентификации на {host}: {e}")
                    print(f"[SMTP DIAGNOSTICS] ✗ Ошибка аутентификации: {e}")
                    server.quit()
                except Exception as e:
                    results["smtp_connection"][host] = f"ERROR: {e}"
                    results["errors"].append(f"Ошибка на {host}: {e}")
                    print(f"[SMTP DIAGNOSTICS] ✗ Ошибка: {e}")
                    try:
                        server.quit()
                    except:
                        pass
            except Exception as e:
                results["smtp_connection"][host] = f"ERROR: {e}"
                results["errors"].append(f"Ошибка подключения к {host}: {e}")
                print(f"[SMTP DIAGNOSTICS] ✗ Ошибка подключения: {e}")
    else:
        print(f"\n[SMTP DIAGNOSTICS] Порт {SMTP_PORT} использует STARTTLS (не тестируется в диагностике)")
    
    print("\n" + "="*60)
    print("[SMTP DIAGNOSTICS] Диагностика завершена")
    print("="*60 + "\n")
    
    return results

def send_verification_email(email: str, username: str, token: str, lang: str = 'ru') -> bool:
    """
    Отправляет email для подтверждения регистрации.
    lang: язык сообщения ('ru', 'en', 'kz')
    """
    verification_url = f"{FRONTEND_URL}/verify-email?token={token}"
    translations = get_email_translation(lang, 'verification')
    
    subject = translations['subject']
    greeting = translations['greeting'].format(username=username)
    body_text = f"""{greeting}

{translations['body_text'].format(verification_url=verification_url)}
"""
    
    body_html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }}
        .email-wrapper {{
            max-width: 600px;
            margin: 0 auto;
            padding: 40px 20px;
        }}
        .email-card {{
            background-color: #ffffff;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }}
        .logo-container {{
            text-align: center;
            margin-bottom: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        }}
        .logo-text {{
            font-size: 24px;
            font-weight: 700;
            color: #1F2937;
            margin: 0;
            font-family: "Times New Roman", Times, serif;
        }}
        .title {{
            font-size: 28px;
            font-weight: bold;
            color: #1a1a1a;
            text-align: center;
            margin: 0 0 20px 0;
        }}
        .message {{
            font-size: 16px;
            color: #333;
            text-align: center;
            margin: 0 0 8px 0;
        }}
        .reason {{
            font-size: 16px;
            color: #333;
            text-align: center;
            margin: 0 0 30px 0;
        }}
        .button-container {{
            text-align: center;
            margin: 30px 0;
        }}
        .button {{
            display: inline-block;
            padding: 14px 32px;
            background-color: #6366f1;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            transition: background-color 0.3s;
        }}
        .button:hover {{
            background-color: #4f46e5;
        }}
        .footer-text {{
            font-size: 14px;
            color: #666;
            text-align: center;
            margin: 30px 0 0 0;
            line-height: 1.5;
        }}
        .url-box {{
            background-color: #f5f5f5;
            border-radius: 8px;
            padding: 12px;
            margin: 20px 0;
            word-break: break-all;
            font-family: monospace;
            font-size: 12px;
            color: #666;
            text-align: center;
        }}
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-card">
            <div class="logo-container">
                <p class="logo-text">FloodSite</p>
            </div>
            <h1 class="title">{translations['body_html_title']} 😃</h1>
            <p class="message">{translations['body_html_message']}</p>
            <p class="reason">{translations.get('body_html_reason', '')}</p>
            <div class="button-container">
                <a href="{verification_url}" class="button">{translations['button_text']}</a>
            </div>
            <p class="footer-text">{translations.get('footer_text', '')}</p>
            <div class="url-box">{verification_url}</div>
        </div>
    </div>
</body>
</html>
"""
    
    return send_email(email, subject, body_html, body_text)

def send_password_reset_email(email: str, username: str, token: str, lang: str = 'ru') -> bool:
    """
    Отправляет email для восстановления пароля.
    lang: язык сообщения ('ru', 'en', 'kz')
    """
    reset_url = f"{FRONTEND_URL}/reset-password?token={token}"
    translations = get_email_translation(lang, 'password_reset')
    
    subject = translations['subject']
    greeting = translations['greeting'].format(username=username)
    body_text = f"""{greeting}

{translations['body_text'].format(reset_url=reset_url)}
"""
    
    body_html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .button {{ display: inline-block; padding: 12px 24px; background-color: #1976d2; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }}
        .button:hover {{ background-color: #1565c0; }}
        .warning {{ color: #d32f2f; font-weight: bold; }}
    </style>
</head>
<body>
    <div class="container">
        <h2>{translations['body_html_title']}</h2>
        <p>{greeting}</p>
        <p>{translations['body_html_message']}</p>
        <a href="{reset_url}" class="button">{translations['button_text']}</a>
        <p>{translations['link_text']}</p>
        <p style="word-break: break-all; color: #666;">{reset_url}</p>
        <p class="warning">{translations['warning']}</p>
        <p>{translations['ignore_text']}</p>
    </div>
</body>
</html>
"""
    
    return send_email(email, subject, body_html, body_text)

def send_email_change_code(email: str, username: str, code: str, lang: str = 'ru') -> bool:
    """
    Отправляет код подтверждения для изменения email на новый адрес.
    lang: язык сообщения ('ru', 'en', 'kz')
    """
    translations = get_email_translation(lang, 'email_change_code')
    
    subject = translations['subject']
    greeting = translations['greeting'].format(username=username)
    body_text = f"""{greeting}

{translations['body_text'].format(code=code)}
"""
    
    body_html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }}
        .email-wrapper {{
            max-width: 600px;
            margin: 0 auto;
            padding: 40px 20px;
        }}
        .email-card {{
            background-color: #ffffff;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }}
        .logo-container {{
            text-align: center;
            margin-bottom: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        }}
        .logo-text {{
            font-size: 24px;
            font-weight: 700;
            color: #1F2937;
            margin: 0;
            font-family: "Times New Roman", Times, serif;
        }}
        .title {{
            font-size: 24px;
            font-weight: bold;
            color: #1a1a1a;
            text-align: center;
            margin: 0 0 20px 0;
        }}
        .message {{
            font-size: 16px;
            color: #333;
            text-align: center;
            margin: 0 0 8px 0;
        }}
        .instruction {{
            font-size: 16px;
            color: #333;
            text-align: center;
            margin: 0 0 30px 0;
        }}
        .code-box {{
            background-color: #f5f5f5;
            border: 3px solid #6366f1;
            border-radius: 12px;
            padding: 24px;
            text-align: center;
            margin: 30px 0;
            font-size: 36px;
            font-weight: bold;
            letter-spacing: 12px;
            color: #6366f1;
            font-family: 'Courier New', monospace;
        }}
        .warning {{
            color: #dc2626;
            font-weight: 600;
            text-align: center;
            font-size: 14px;
            margin: 20px 0;
        }}
        .footer-text {{
            font-size: 14px;
            color: #666;
            text-align: center;
            margin: 30px 0 0 0;
            line-height: 1.5;
        }}
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-card">
            <div class="logo-container">
                <p class="logo-text">FloodSite</p>
            </div>
            <h1 class="title">{translations['body_html_title']}</h1>
            <p class="message">{translations['body_html_message']}</p>
            <p class="instruction">{translations.get('body_html_instruction', '')}</p>
            <div class="code-box">{code}</div>
            <p class="warning">{translations['warning']}</p>
            <p class="footer-text">{translations.get('footer_text', '')}</p>
        </div>
    </div>
</body>
</html>
"""
    
    return send_email(email, subject, body_html, body_text)
