#!/usr/bin/env bash
set -euo pipefail

# deploy_vps.sh
# Uso: deploy_vps.sh [--build-web]
# - puxa os repositórios em /opt/apps/finance-dev
# - opcionalmente roda build do frontend em /opt/apps/finance-dev/finance-web
# - copia dist para /opt/apps/finance-dev/web/dist
# - reinicia containers com docker compose

APP_DIR=/opt/apps/finance-dev
COMPOSE_FILE=${APP_DIR}/docker-compose.dev.yml

BUILD_WEB=false
for arg in "$@"; do
  case "$arg" in
    --build-web) BUILD_WEB=true ;;
    *) echo "Unknown arg: $arg" ; exit 1 ;;
  esac
done

echo "[deploy] Pulling latest code in ${APP_DIR}..."
for repo in finance-api finance-web; do
  if [ ! -d "${APP_DIR}/${repo}" ]; then
    echo "[deploy] repo ${APP_DIR}/${repo} does not exist, skipping"
    continue
  fi
  echo "[deploy] Updating ${repo}..."
  cd "${APP_DIR}/${repo}"
  git fetch origin
  git reset --hard origin/main
  git clean -fd
done

if [ "$BUILD_WEB" = true ]; then
  echo "[deploy] Building frontend in ${APP_DIR}/finance-web..."
  cd "${APP_DIR}/finance-web"
  # install & build (assumes node/npm available on VPS)
  npm ci --no-audit --no-fund
  npm run build

  echo "[deploy] Copying dist to web serving directory..."
  rm -rf "${APP_DIR}/web/dist"
  mkdir -p "${APP_DIR}/web"
  cp -r "${APP_DIR}/finance-web/dist" "${APP_DIR}/web/dist"
fi

echo "[deploy] Restarting containers with docker compose..."
cd "${APP_DIR}"
docker compose -f "${COMPOSE_FILE}" up -d --build

echo "[deploy] Optionally apply DB migration 006 (pago)"
if command -v psql >/dev/null 2>&1; then
  if [ -f "${APP_DIR}/finance-api/migrations/006_add_pago_lancamentos.sql" ]; then
    echo "[deploy] Applying migration 006_add_pago_lancamentos.sql using psql (requires DATABASE_URL env)"
    if [ -z "${DATABASE_URL:-}" ]; then
      echo "[deploy] DATABASE_URL not set — skipping automatic migration. To run manually:"
      echo "  psql <your_database_connection> -f ${APP_DIR}/finance-api/migrations/006_add_pago_lancamentos.sql"
    else
      psql "$DATABASE_URL" -f "${APP_DIR}/finance-api/migrations/006_add_pago_lancamentos.sql"
    fi
  else
    echo "[deploy] migration file not found, skipping"
  fi
else
  echo "[deploy] psql not available on host — skipping automatic SQL migration"
fi

echo "[deploy] Done. Check container logs: docker compose -f ${COMPOSE_FILE} logs -f api_dev"
