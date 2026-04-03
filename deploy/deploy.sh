#!/usr/bin/env bash
# Деплой на сервере: сборка образов и запуск compose из корня репозитория.
#
# Перед первым запуском:
#   1) cp deploy.env.example .env
#   2) Отредактируйте .env (POSTGRES_PASSWORD, SECRET_KEY, CORS_ORIGINS, FRONTEND_URL)
#   3) Секреты: openssl rand -hex 32
#
# Запуск из корня репозитория:
#   bash deploy/deploy.sh
#
# Обновление кода после git pull:
#   bash deploy/deploy.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Ошибка: нет файла .env в $ROOT"
  echo "Скопируйте шаблон:  cp deploy.env.example .env  и заполните переменные."
  exit 1
fi

echo ">>> Сборка и запуск контейнеров..."
docker compose build --pull
docker compose up -d

echo ">>> Статус:"
docker compose ps

echo ""
echo "Готово. Сайт: FRONTEND_URL из .env (порт на хосте — HTTP_PORT, по умолчанию 80)."
echo "Логи API: docker compose logs -f api"
