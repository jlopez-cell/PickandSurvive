/**
 * Sincroniza equipos de LaLiga Hypermotion desde football-data.org (requiere FOOTBALL_DATA_ORG_TOKEN).
 * Uso (desde apps/api): pnpm run db:sync:hypermotion
 */
import { PrismaClient } from '@prisma/client';

const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';
const FOOTBALL_DATA_TEAM_ID_FACTOR = 1_000_000;
const LEAGUE_NAME = 'LaLiga Hypermotion';

async function main() {
  const token = process.env.FOOTBALL_DATA_ORG_TOKEN;
  if (!token?.trim()) {
    throw new Error('Define FOOTBALL_DATA_ORG_TOKEN en el entorno (.env en apps/api)');
  }

  const prisma = new PrismaClient();

  try {
    const league = await prisma.footballLeague.findFirst({
      where: { name: LEAGUE_NAME },
    });
    if (!league) {
      throw new Error(`Liga "${LEAGUE_NAME}" no encontrada. Ejecuta primero pnpm run db:seed`);
    }

    const url = new URL(`${FOOTBALL_DATA_BASE}/competitions/${league.apiFootballId}/teams`);
    url.searchParams.set('season', String(league.currentSeason));
    url.searchParams.set('limit', '200');

    const res = await fetch(url, { headers: { 'X-Auth-Token': token } });
    if (!res.ok) {
      throw new Error(`football-data ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as { teams?: { id: number; name: string; crest?: string }[] };
    const teams = data.teams ?? [];
    if (teams.length === 0) {
      throw new Error('La API no devolvió equipos (revisa temporada o token / plan)');
    }

    for (const t of teams) {
      const apiFootballId = league.apiFootballId * FOOTBALL_DATA_TEAM_ID_FACTOR + t.id;
      await prisma.footballTeam.upsert({
        where: { apiFootballId },
        update: { name: t.name, logoUrl: t.crest ?? '', leagueId: league.id },
        create: {
          leagueId: league.id,
          apiFootballId,
          name: t.name,
          logoUrl: t.crest ?? '',
        },
      });
    }

    console.log(`✓ ${teams.length} equipos sincronizados (${LEAGUE_NAME}, temporada ${league.currentSeason})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
