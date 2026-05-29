import { NotFoundException } from '@nestjs/common';
import { EditionStatus, JoinRequestStatus, Prisma } from '@prisma/client';

/**
 * Matricula en la edición a todos los miembros con solicitud APPROVED del campeonato, al admin,
 * y a quienes participaron en la **última edición FINISHED** del mismo campeonato (salvo REJECTED).
 * Idempotente (no duplica participantes ni cuotas).
 */
export async function syncApprovedMembersToEditionTx(
  tx: Prisma.TransactionClient,
  editionId: string,
): Promise<void> {
  const edition = await tx.edition.findUnique({
    where: { id: editionId },
    select: {
      id: true,
      potAmountCents: true,
      championshipId: true,
      championship: { select: { adminId: true } },
    },
  });
  if (!edition) throw new NotFoundException('Edición no encontrada');

  const approved = await tx.joinRequest.findMany({
    where: { championshipId: edition.championshipId, status: JoinRequestStatus.APPROVED },
    select: { userId: true },
  });
  const userIds = new Set(approved.map((a) => a.userId));
  userIds.add(edition.championship.adminId);

  const previousFinished = await tx.edition.findFirst({
    where: {
      championshipId: edition.championshipId,
      status: EditionStatus.FINISHED,
      id: { not: editionId },
    },
    orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true },
  });

  if (previousFinished) {
    const formerParticipants = await tx.participant.findMany({
      where: { editionId: previousFinished.id },
      select: { userId: true },
    });
    for (const { userId } of formerParticipants) {
      const jr = await tx.joinRequest.findUnique({
        where: {
          championshipId_userId: {
            championshipId: edition.championshipId,
            userId,
          },
        },
      });
      if (jr?.status === JoinRequestStatus.REJECTED) continue;
      userIds.add(userId);
    }
  }

  for (const uid of userIds) {
    const existing = await tx.participant.findUnique({
      where: { userId_editionId: { userId: uid, editionId } },
    });
    if (existing) continue;

    await tx.participant.create({
      data: { userId: uid, editionId },
    });

    if (edition.potAmountCents > 0) {
      await tx.potLedger.create({
        data: {
          editionId,
          userId: uid,
          type: 'ENTRY_FEE',
          amountCents: edition.potAmountCents,
          description: `Cuota de entrada (edición ${editionId})`,
        },
      });
    }
  }
}
