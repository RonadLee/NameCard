#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v psql >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y postgresql postgresql-contrib
fi

sudo service postgresql start
until pg_isready -q; do sleep 1; done

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='namecard'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER namecard WITH PASSWORD 'namecard' SUPERUSER"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='namecard'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE namecard OWNER namecard"

if [[ ! -f apps/api/.env ]]; then
  cp .env.example apps/api/.env
fi

npm ci
npm run prisma:generate -w api
npm run build -w api
npm run db:migrate -w api
npm run db:seed -w api
