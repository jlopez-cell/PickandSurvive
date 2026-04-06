#!/usr/bin/env bash
# Despliegue al VPS: sincroniza el repo (sin node_modules ni builds) y ejecuta install + migrate + build + PM2.
#
# Uso desde la raíz del monorepo:
#   ./scripts/deploy-vps.sh usuario@IP_O_HOST
#
# Opcional:
#   DEPLOY_REMOTE_PATH=/opt/pickandsurvive ./scripts/deploy-vps.sh usuario@host

set -euo pipefail

REMOTE="${1:-}"
REMOTE_PATH="${DEPLOY_REMOTE_PATH:-/opt/pickandsurvive}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -z "$REMOTE" ]]; then
  echo "Uso: $0 usuario@ip_o_host"
  echo "Ejemplo: $0 root@76.13.48.187"
  exit 1
fi

cd "$REPO_ROOT"

echo "==> Rsync → ${REMOTE}:${REMOTE_PATH}"
rsync -avz \
  --human-readable \
  --progress \
  --delete \
  --filter='P apps/web/.env.production' \
  --filter='P apps/api/.env' \
  --exclude node_modules \
  --exclude .git \
  --exclude ".next" \
  --exclude "apps/web/.next" \
  --exclude "apps/api/dist" \
  --exclude ".env" \
  --exclude "apps/api/.env" \
  --exclude "apps/web/.env.production" \
  --exclude "apps/web/.env.local" \
  --exclude "apps/web/.env.production.local" \
  --exclude "*.log" \
  --exclude ".turbo" \
  --exclude "venv" \
  --exclude "INFORMACION_SERVIDOR_VPS.local.md" \
  ./ "${REMOTE}:${REMOTE_PATH}/"

echo "==> Comandos remotos (install, migrate, build, pm2)"
ssh -o StrictHostKeyChecking=accept-new "$REMOTE" bash "${REMOTE_PATH}/scripts/remote-post-deploy.sh"

echo "==> Despliegue terminado."
