/**
 * Matricula en la edición más reciente (DRAFT/OPEN/ACTIVE) a miembros aprobados + última FINISHED.
 * Tras `pnpm --filter @pickandsurvive/api run build`, desde apps/api:
 *   node --env-file=.env ./scripts/resync-latest-championship-edition.cjs [nombreCampeonato]
 */
const championshipName = process.argv[2] || 'pickandsurvive';

const { PrismaClient } = require('@prisma/client');
const { syncApprovedMembersToEditionTx } = require('../dist/src/championships/edition-member-sync');

const prisma = new PrismaClient();

(async () => {
  const champ = await prisma.championship.findFirst({
    where: { name: { equals: championshipName, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (!champ) {
    console.error(JSON.stringify({ error: 'Campeonato no encontrado', championshipName }));
    process.exit(1);
  }

  const edition = await prisma.edition.findFirst({
    where: {
      championshipId: champ.id,
      status: { in: ['DRAFT', 'OPEN', 'ACTIVE'] },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, createdAt: true },
  });

  if (!edition) {
    console.error(
      JSON.stringify({
        error: 'No hay edición en borrador, abierta o activa',
        championship: champ.name,
      }),
    );
    process.exit(1);
  }

  await prisma.$transaction(async (tx) => {
    await syncApprovedMembersToEditionTx(tx, edition.id);
  });

  const count = await prisma.participant.count({ where: { editionId: edition.id } });

  console.log(
    JSON.stringify(
      {
        ok: true,
        championship: champ.name,
        editionId: edition.id,
        editionStatus: edition.status,
        participantCount: count,
      },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
