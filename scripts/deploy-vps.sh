#!/usr/bin/env bash
# Despliegue al VPS: sincroniza el repo (sin node_modules ni builds) y ejecuta install + migrate + build + PM2.
#
# Uso desde la raíz del monorepo:
#   ./scripts/deploy-vps.sh usuario@IP_O_HOST                    # solo permite rama main
#   ./scripts/deploy-vps.sh usuario@IP_O_HOST --branch develop   # rama específica (staging/testing)
#
# Opcional:
#   DEPLOY_REMOTE_PATH=/opt/pickandsurvive ./scripts/deploy-vps.sh usuario@host

set -euo pipefail

REMOTE="${1:-}"
BRANCH_FLAG=""
REMOTE_PATH="${DEPLOY_REMOTE_PATH:-/opt/pickandsurvive}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

shift 1 2>/dev/null || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch) BRANCH_FLAG="$2"; shift 2 ;;
    *) echo "Argumento desconocido: $1"; exit 1 ;;
  esac
done

if [[ -z "$REMOTE" ]]; then
  echo "Uso: $0 usuario@ip_o_host [--branch nombre_rama]"
  echo "Ejemplo: $0 root@76.13.48.187"
  echo "         $0 root@76.13.48.187 --branch develop"
  exit 1
fi

cd "$REPO_ROOT"

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Si se pasó --branch, verificar que el usuario esté en esa rama
if [[ -n "$BRANCH_FLAG" && "$BRANCH_FLAG" != "$CURRENT_BRANCH" ]]; then
  echo "ERROR: --branch '$BRANCH_FLAG' indicado pero estás en '$CURRENT_BRANCH'."
  echo "       Hacé: git checkout $BRANCH_FLAG   y volvé a correr el script."
  exit 1
fi

TARGET_BRANCH="${BRANCH_FLAG:-$CURRENT_BRANCH}"

# Bloquear deploy desde main si hay cambios sin commitear
if [[ "$TARGET_BRANCH" == "main" ]]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "ERROR: hay cambios sin commitear en main. Commiteá o stasheá antes de deployar."
    exit 1
  fi
fi

# Advertencia y confirmación para ramas que no sean main
if [[ "$TARGET_BRANCH" != "main" ]]; then
  echo "-------------------------------------------------------"
  echo "  ATENCION: deployando rama '$TARGET_BRANCH' (no es main)"
  echo "  Esto sobreescribirá lo que haya en el VPS."
  echo "  Usá solo para pruebas. No deployar develop a produccion"
  echo "  sin antes mergear a main."
  echo "-------------------------------------------------------"
  read -r -p "  Confirmar deploy de '$TARGET_BRANCH'? [s/N] " confirm
  if [[ "$confirm" != "s" && "$confirm" != "S" ]]; then
    echo "Deploy cancelado."
    exit 0
  fi
fi

echo "==> Deployando rama '$TARGET_BRANCH' → ${REMOTE}:${REMOTE_PATH}"
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
