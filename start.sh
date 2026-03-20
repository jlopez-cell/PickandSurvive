#!/bin/bash

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT_DIR/apps/api"
WEB_DIR="$ROOT_DIR/apps/web"
API_URL="http://localhost:3001"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo "  Pick & Survive — Arranque local"
echo "  ================================"
echo ""

# ─── 1. PostgreSQL ─────────────────────────────────────────────────────────────

log "Verificando PostgreSQL..."

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "pickandsurvive_postgres"; then
  log "PostgreSQL ya está corriendo (Docker)"
else
  warn "Iniciando PostgreSQL con Docker Compose..."
  cd "$ROOT_DIR"
  docker compose up -d postgres

  warn "Esperando a que PostgreSQL esté listo..."
  for i in {1..30}; do
    if docker exec pickandsurvive_postgres pg_isready -U postgres -d pickandsurvive &>/dev/null 2>&1; then
      log "PostgreSQL listo"
      break
    fi
    if [ $i -eq 30 ]; then
      err "PostgreSQL no respondió a tiempo. Revisa Docker."
    fi
    sleep 2
  done
fi

# ─── 2. Migraciones ────────────────────────────────────────────────────────────

log "Ejecutando migraciones de base de datos..."
cd "$API_DIR"
pnpm prisma migrate deploy 2>&1 | grep -E "(Applied|already applied|No pending|Error)" || true
log "Migraciones aplicadas"

# ─── 3. Seed (ligas + superadmin) ─────────────────────────────────────────────

LEAGUE_COUNT=$(docker exec pickandsurvive_postgres psql -U postgres -d pickandsurvive -t -c 'SELECT count(*) FROM "FootballLeague";' 2>/dev/null | tr -d ' \n' || echo "0")

if [ "$LEAGUE_COUNT" = "0" ] || [ -z "$LEAGUE_COUNT" ]; then
  log "Base de datos vacía — ejecutando seed..."
  cd "$API_DIR"
  pnpm db:seed
else
  log "Ligas ya presentes en BD ($LEAGUE_COUNT ligas) — actualizando superadmin..."
  cd "$API_DIR"
  pnpm db:seed 2>&1 | grep -E "(✓|Credentials|Email|Password)" || true
fi

# ─── 4. Lanzar API ─────────────────────────────────────────────────────────────

# Liberar puertos por si hay procesos previos
kill $(lsof -ti:3001) 2>/dev/null || true
kill $(lsof -ti:3000) 2>/dev/null || true
sleep 1

echo ""
log "Iniciando API (NestJS) en puerto 3001..."
cd "$API_DIR"
pnpm start:dev > /tmp/pickandsurvive-api.log 2>&1 &
API_PID=$!

# Esperar a que la API esté lista
warn "Esperando a que la API arranque..."
for i in {1..40}; do
  if curl -s "$API_URL/auth/login" -o /dev/null -w "%{http_code}" 2>/dev/null | grep -q "^[245]"; then
    log "API lista"
    break
  fi
  if [ $i -eq 40 ]; then
    err "La API no arrancó a tiempo. Logs en /tmp/pickandsurvive-api.log"
  fi
  sleep 3
done

# ─── 5. Sincronizar equipos y jornadas desde API-Football ──────────────────────

# Login como superadmin para obtener JWT (siempre necesario para sincronizar jornadas)
TOKEN=$(curl -sf -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pickandsurvive.com","password":"Admin1234!"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  warn "No se pudo obtener token. Equipos y jornadas no se sincronizarán ahora."
else
  TEAM_COUNT=$(docker exec pickandsurvive_postgres psql -U postgres -d pickandsurvive -t -c 'SELECT count(*) FROM "FootballTeam";' 2>/dev/null | tr -d ' \n' || echo "0")

  if [ "$TEAM_COUNT" = "0" ] || [ -z "$TEAM_COUNT" ]; then
    log "Sincronizando equipos desde API-Football..."

    LEAGUES_JSON=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API_URL/admin/leagues")

    echo "$LEAGUES_JSON" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | while read LEAGUE_ID; do
      SYNC_RESULT=$(curl -sf -X POST -H "Authorization: Bearer $TOKEN" "$API_URL/admin/leagues/$LEAGUE_ID/sync" 2>&1 || echo "error")
      if echo "$SYNC_RESULT" | grep -q "error"; then
        warn "  Error sincronizando equipos de liga $LEAGUE_ID"
      else
        log "  Equipos sincronizados: $LEAGUE_ID"
      fi
    done

    log "Sincronización de equipos completada"
  else
    log "Equipos ya sincronizados ($TEAM_COUNT equipos en BD)"
  fi

  # Sincronizar jornadas (fixtures) siempre — son necesarias para hacer picks
  MATCHDAY_COUNT=$(docker exec pickandsurvive_postgres psql -U postgres -d pickandsurvive -t -c 'SELECT count(*) FROM "Matchday";' 2>/dev/null | tr -d ' \n' || echo "0")

  if [ "$MATCHDAY_COUNT" = "0" ] || [ -z "$MATCHDAY_COUNT" ]; then
    log "Sincronizando jornadas desde API-Football..."
    SYNC_RESULT=$(curl -sf -X POST -H "Authorization: Bearer $TOKEN" "$API_URL/admin/sync-fixtures" 2>&1 || echo "error")
    if echo "$SYNC_RESULT" | grep -q "error"; then
      warn "Error al sincronizar jornadas. Comprueba API_FOOTBALL_KEY en .env"
    else
      log "Jornadas sincronizadas"
    fi
  else
    log "Jornadas ya sincronizadas ($MATCHDAY_COUNT jornadas en BD)"
  fi
fi

# ─── 6. Lanzar Web ─────────────────────────────────────────────────────────────

log "Iniciando Web (Next.js) en puerto 3000..."
cd "$WEB_DIR"
pnpm dev &
WEB_PID=$!

# ─── Info ───────────────────────────────────────────────────────────────────────

echo ""
echo "  ┌──────────────────────────────────────────────────┐"
echo "  │  Web:     http://localhost:3000                   │"
echo "  │  API:     http://localhost:3001                   │"
echo "  │  BD:      localhost:5432/pickandsurvive           │"
echo "  │                                                    │"
echo "  │  Admin:   admin@pickandsurvive.com                │"
echo "  │  Pass:    Admin1234!                              │"
echo "  └──────────────────────────────────────────────────┘"
echo ""
echo "  Pulsa Ctrl+C para detener todo"
echo ""

# ─── Limpieza ──────────────────────────────────────────────────────────────────

cleanup() {
  echo ""
  warn "Deteniendo procesos..."
  kill $API_PID $WEB_PID 2>/dev/null || true
  log "Aplicación detenida"
  exit 0
}

trap cleanup INT TERM

wait
