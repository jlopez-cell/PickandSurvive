/**
 * Tras `pnpm --filter @pickandsurvive/api run build`, desde apps/api:
 *   node --env-file=.env ./scripts/resync-edition.cjs <editionId>
 */
const editionId = process.argv[2];
if (!editionId) {
  console.error('Uso: node --env-file=.env ./scripts/resync-edition.cjs <editionId>');
  process.exit(1);
}

const { PrismaClient } = require('@prisma/client');
const { syncApprovedMembersToEditionTx } = require('../dist/src/championships/edition-member-sync');

const prisma = new PrismaClient();

prisma
  .$transaction(async (tx) => {
    await syncApprovedMembersToEditionTx(tx, editionId);
  })
  .then(() => {
    console.log(JSON.stringify({ ok: true, editionId }));
    return prisma.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
