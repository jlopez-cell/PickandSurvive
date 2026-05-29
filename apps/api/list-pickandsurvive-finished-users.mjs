/**
 * Uso en el VPS:
 *   cd /opt/pickandsurvive/apps/api && node --env-file=.env ./list-pickandsurvive-finished-users.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const champ = await prisma.championship.findFirst({
    where: { name: { equals: 'pickandsurvive', mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (!champ) {
    console.log(JSON.stringify({ error: 'No hay campeonato con nombre pickandsurvive' }));
    process.exit(1);
  }

  const edition = await prisma.edition.findFirst({
    where: { championshipId: champ.id, status: 'FINISHED' },
    orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, finishedAt: true, createdAt: true, startMatchday: true, endMatchday: true },
  });
  if (!edition) {
    console.log(JSON.stringify({ error: 'No hay edición FINISHED para ese campeonato', championship: champ }));
    process.exit(1);
  }

  const participants = await prisma.participant.findMany({
    where: { editionId: edition.id },
    include: { user: { select: { id: true, alias: true, email: true } } },
    orderBy: { user: { alias: 'asc' } },
  });

  const out = {
    championship: champ.name,
    editionId: edition.id,
    editionFinishedAt: edition.finishedAt,
    editionStartMatchday: edition.startMatchday,
    editionEndMatchday: edition.endMatchday,
    count: participants.length,
    users: participants.map((p) => ({
      id: p.user.id,
      alias: p.user.alias,
      email: p.user.email,
    })),
  };
  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
