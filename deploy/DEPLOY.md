# Деплой FloodSite (Docker + Ubuntu)

В инструкции два контекста:

| Где | Что это |
|-----|---------|
| **На вашем ПК** | Терминал на Windows (PowerShell, CMD) или ваш редактор — подготовка кода и доступ к серверу. |
| **На сервере Ubuntu** | Сессия по **SSH** после команды вроде `ssh user@IP_сервера` — установка Docker, клон репозитория, запуск контейнеров. |

Файлы с настройками создаются **на сервере** в каталоге проекта (кроме случая, когда вы правите код локально и пушите в Git).

---

## Какие файлы за что отвечают

| Файл | Где лежит | Зачем |
|------|-----------|--------|
| **`deploy.env.example`** | в репозитории, в корне проекта | Шаблон переменных окружения. **Не редактируйте** как секреты в Git — только копируйте. |
| **`.env`** | в **корне проекта на сервере** (`~/floodsite/.env`) | Реальные пароли, ключи, URL сайта. **В Git не коммитить** (файл в `.gitignore`). Docker Compose читает его при `docker compose up`. |
| **`docker-compose.yml`** | корень проекта | Описание сервисов `db`, `api`, `web`. Обычно **не меняют** при деплое. |
| **`deploy/install-docker-ubuntu.sh`** | `deploy/` | Скрипт установки Docker на Ubuntu (альтернатива ручным командам). |
| **`deploy/deploy.sh`** | `deploy/` | Сборка образов и `docker compose up -d` на сервере. |

Что **писать в `.env`** — см. раздел [Содержимое `.env`](#содержимое-env) ниже.

---

## Часть 1 — на вашем ПК

### 1.1 Код в Git

Сделайте так, чтобы актуальный код был в удалённом репозитории (GitHub, GitLab и т.д.):

```powershell
# Пример в PowerShell на ПК (папка с проектом)
git add .
git commit -m "Deploy"
git push origin main
```

Подставьте свою ветку вместо `main`, если она другая.

### 1.2 Доступ к серверу

У вас должны быть:

- **IP** или **домен** сервера Ubuntu  
- **логин** SSH (часто `ubuntu` или ваш пользователь)  
- **ключ** или пароль для входа  

Подключение с ПК (PowerShell или терминал):

```powershell
ssh ваш_логин@IP_или_домен
```

Дальше все команды из разделов «На сервере Ubuntu» выполняются **уже в этой SSH-сессии**, если не сказано иначе.

### 1.3 (Опционально) Запомнить URL сайта

На ПК можно просто записать, как пользователь будет открывать сайт:

- `http://203.0.113.10` — по IP  
- `https://site.example.com` — по домену с HTTPS  

Тот же адрес (без слэша в конце) позже попадёт в **`CORS_ORIGINS`** и **`FRONTEND_URL`** в файле **`.env` на сервере**.

---

## Часть 2 — на сервере Ubuntu (SSH)

### 2.1 Установка Docker

Выполняйте **по очереди** в SSH-сессии на сервере.

Обновление пакетов:

```bash
sudo apt-get update
```

Зависимости:

```bash
sudo apt-get install -y ca-certificates curl gnupg
```

Ключ и репозиторий Docker:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

```bash
. /etc/os-release && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

Установка:

```bash
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Права для вашего пользователя (чтобы не писать `sudo docker` каждый раз):

```bash
sudo usermod -aG docker "$USER"
```

Выйдите из SSH и зайдите снова **или** выполните:

```bash
newgrp docker
```

Проверка:

```bash
docker --version
docker compose version
docker run --rm hello-world
```

**Альтернатива:** из каталога проекта после `git clone`:

```bash
sudo bash deploy/install-docker-ubuntu.sh
```

(затем снова `usermod` / `newgrp`, как выше).

---

### 2.2 Клонирование репозитория на сервер

На сервере:

```bash
cd ~
git clone https://github.com/ВАШ_АККАУНТ/floodsite.git
cd ~/floodsite
```

Замените URL на свой. Если репозиторий приватный — настройте [SSH-ключ](https://docs.github.com/en/authentication/connecting-to-github-with-ssh) или токен для `git clone`.

---

### 2.3 Файл `.env` на сервере

#### Откуда взять

Шаблон уже в репозитории. На сервере:

```bash
cd ~/floodsite
cp deploy.env.example .env
```

#### Куда писать

Редактируете только файл **`.env`** в корне проекта на сервере, например:

```bash
nano ~/floodsite/.env
```

Сохранение в `nano`: `Ctrl+O`, Enter, выход: `Ctrl+X`.

#### Автозаполнение паролей и URL (удобно вставить блоком)

Сначала задайте публичный адрес сайта (**как в браузере**, без `/` в конце):

```bash
export PUBLIC_URL="http://ВАШ_IP"
# или: export PUBLIC_URL="https://ваш.домен"
cd ~/floodsite
cp deploy.env.example .env
export PG_PASS=$(openssl rand -hex 16)
export SECRET_KEY=$(openssl rand -hex 32)
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${PG_PASS}|" .env
sed -i "s|^SECRET_KEY=.*|SECRET_KEY=${SECRET_KEY}|" .env
sed -i "s#^CORS_ORIGINS=.*#CORS_ORIGINS=${PUBLIC_URL}#" .env
sed -i "s#^FRONTEND_URL=.*#FRONTEND_URL=${PUBLIC_URL}#" .env
```

После этого при необходимости допишите SMTP в **том же** `.env` вручную (см. таблицу ниже).

---

### Содержимое `.env`

| Переменная | Куда писать | Что указать |
|------------|-------------|-------------|
| `POSTGRES_USER` | `.env` | Обычно `flood` (как в шаблоне). |
| `POSTGRES_PASSWORD` | `.env` | Сложный пароль. **Без** символов `@ : / ? #` в пароле (иначе может сломаться строка подключения). |
| `POSTGRES_DB` | `.env` | Обычно `floodDB`. |
| `SECRET_KEY` | `.env` | Секрет для JWT. Сгенерировать: `openssl rand -hex 32`. |
| `CORS_ORIGINS` | `.env` | Точный origin из адресной строки: `https://домен` или `http://IP`. Несколько значений — через запятую без пробелов. |
| `FRONTEND_URL` | `.env` | Тот же базовый URL **без** слэша в конце — для ссылок в письмах (верификация, сброс пароля). |
| `HTTP_PORT` | `.env` | Порт на сервере, на который смотрит nginx (по умолчанию `80`). |
| `HYDRO_SCHEDULER_DISABLED` | `.env` | `1` — отключить Selenium-парсер в контейнере (рекомендуется, если нет Chrome в образе). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL` | `.env` | Раскомментируйте и заполните, если нужна почта. Подробнее: `backend/docs/EMAIL_SETUP.md`. |

Переменные для API/карт (по желанию) — в конце шаблона `deploy.env.example`.

**Важно:** файл **`.env`** хранится только на сервере и не должен попадать в Git.

---

### 2.4 Запуск и обновление

Первый запуск и пересборка (на сервере):

```bash
cd ~/floodsite
bash deploy/deploy.sh
```

Проверка:

```bash
docker compose ps
```

Логи бэкенда:

```bash
cd ~/floodsite
docker compose logs -f api
```

После того как на **ПК** вы сделали `git push`, на **сервере**:

```bash
cd ~/floodsite
git pull
bash deploy/deploy.sh
```

---

## Краткая шпаргалка «где что делать»

| Действие | Где |
|----------|-----|
| Правка кода, коммит, `git push` | **ПК** |
| `ssh user@сервер` | **ПК** |
| Установка Docker, `git clone`, `cp deploy.env.example .env`, правка `.env`, `deploy/deploy.sh`, `docker compose` | **Сервер Ubuntu (SSH)** |
| Секреты и URL сайта | Файл **`.env` только на сервере** в `~/floodsite/` |

---

## Firewall и HTTPS

- На сервере при необходимости откройте порт (пример для UFW):  
  `sudo ufw allow 80/tcp`  
  и при использовании HTTPS на этом же хосте:  
  `sudo ufw allow 443/tcp`

- HTTPS (Let’s Encrypt) часто делают отдельным **Caddy** или **nginx + certbot** на хосте. После включения HTTPS снова проверьте в **`.env`**: `CORS_ORIGINS` и `FRONTEND_URL` должны начинаться с `https://`.

### Загрузка больших файлов (HEC-RAS `.db`)

В образе **web** уже задано **`client_max_body_size 512m`** в `docker/nginx/default.conf` для всего виртуального хоста (в том числе для префикса `/api/`). Если при загрузке в браузере приходит **413 Request Entity Too Large**, а в этом репозитории лимит уже большой, значит перед контейнером стоит **другой прокси** (nginx/Caddy/балансировщик на хосте или у провайдера). На нём нужно увеличить лимит тела запроса, например для nginx:

```nginx
client_max_body_size 512m;
```

(в `server { ... }` или `http { ... }` для нужного сайта). После изменения перезагрузите nginx на хосте. Интерфейс приложения показывает понятное сообщение при 413, но без правки внешнего прокси большие файлы всё равно не дойдут до API.

---

## Если что-то не работает

1. `docker compose ps` — все три сервиса должны быть `Up`.  
2. `docker compose logs api` — ошибки БД, импорта, переменных.  
3. Убедитесь, что **`CORS_ORIGINS`** совпадает с тем, как вы открываете сайт в браузере.

Официальная установка Docker: [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/).
