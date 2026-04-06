#!/usr/bin/env bash
set -euo pipefail

cd /opt/pickandsurvive

echo "[1/7] Verificando runtime"
node -v
pnpm -v

echo "[2/7] Configurando PostgreSQL"
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='pickandsurvive'" | grep -q 1; then
  sudo -u postgres createdb -O postgres pickandsurvive
fi

echo "[3/7] Ajustando variables de entorno"
if [ -f apps/api/.env ]; then
  sed -i "s#^DATABASE_URL=.*#DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pickandsurvive#" apps/api/.env
  sed -i "s#^APP_URL=.*#APP_URL=http://76.13.48.187#" apps/api/.env
fi
printf "NEXT_PUBLIC_API_URL=http://127.0.0.1:3001\n" > apps/web/.env.production

echo "[4/7] Instalando dependencias"
pnpm install --frozen-lockfile || pnpm install

echo "[5/7] Prisma y build"
pnpm --filter @pickandsurvive/api run db:generate
pnpm --filter @pickandsurvive/api run db:migrate:prod
pnpm --filter @pickandsurvive/api run build
pnpm --filter @pickandsurvive/web run build

echo "[6/7] Arrancando servicios con PM2"
pm2 delete pick-api >/dev/null 2>&1 || true
pm2 delete pick-web >/dev/null 2>&1 || true
pm2 start apps/api/dist/main.js --name pick-api --cwd /opt/pickandsurvive/apps/api
pm2 start "pnpm --filter @pickandsurvive/web start" --name pick-web --cwd /opt/pickandsurvive
pm2 save

echo "[7/7] Hecho"
pm2 status
