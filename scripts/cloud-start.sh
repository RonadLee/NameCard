#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

sudo service postgresql start
until pg_isready -q; do sleep 1; done

if [[ ! -f apps/api/.env ]]; then
  cp .env.example apps/api/.env
fi

cd "$root/apps/api"
npx prisma migrate deploy

tmux has-session -t namecard-api 2>/dev/null || tmux new-session -d -s namecard-api -c "$root/apps/api" "node --enable-source-maps dist/main.js"
tmux has-session -t namecard-web 2>/dev/null || tmux new-session -d -s namecard-web -c "$root/apps/web" "npx next dev --hostname 0.0.0.0 --port 3000"

for _ in $(seq 1 40); do
  if curl -sf http://127.0.0.1:4000/health >/dev/null && curl -sf http://127.0.0.1:3000/login >/dev/null; then
    exit 0
  fi
  sleep 1
done

echo "NameCard did not become ready" >&2
exit 1
