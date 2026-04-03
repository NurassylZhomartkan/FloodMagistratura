#!/usr/bin/env bash
# Установка Docker Engine + Compose plugin на Ubuntu (22.04 / 24.04).
# Запуск: sudo bash deploy/install-docker-ubuntu.sh

set -euo pipefail

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Запустите с sudo."
  exit 1
fi

apt-get update -qq
apt-get install -y ca-certificates curl gnupg

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update -qq
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "Docker установлен. Добавьте пользователя в группу docker и перелогиньтесь:"
echo "  sudo usermod -aG docker \"\$USER\""
echo "  newgrp docker   # или выход/вход в SSH-сессию"
