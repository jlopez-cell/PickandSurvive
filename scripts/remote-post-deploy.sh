#!/usr/bin/env bash
# Se ejecuta EN EL VPS tras rsync (ver deploy-vps-expect.exp / deploy-vps.sh).
set -euo pipefail

cd /opt/pickandsurvive

export PATH="/usr/local/bin:/usr/bin:${HOME}/.local/share/pnpm:${PATH}"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm no encontrado en PATH"
  exit 1
fi

pnpm install

pnpm --filter @pickandsurvive/api run db:generate
pnpm --filter @pickandsurvive/api exec prisma migrate deploy

pnpm --filter @pickandsurvive/api run build
pnpm --filter @pickandsurvive/web run build

pm2 restart pick-api pick-web

echo "==> OK"
pm2 status
