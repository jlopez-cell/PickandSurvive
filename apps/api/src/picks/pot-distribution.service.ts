import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PotDistributionService {
  private readonly logger = new Logger(PotDistributionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Distribute the pot among winner participants.
   * EC-20: rounding — remainder cent goes to oldest participant.
   */
  async distribute(editionId: string, winnerParticipantIds: string[]) {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: { potLedger: true },
    });

    if (!edition) return;

    // Sum up all pot contributions (entry fees + accumulated from previous editions)
    const totalCents = edition.potLedger
      .filter((e) => e.type === 'ENTRY_FEE' || e.type === 'ACCUMULATED_IN')
      .reduce((sum, e) => sum + e.amountCents, 0);

    if (totalCents === 0) {
      this.logger.log(`Edition ${editionId} has no pot to distribute`);
      return;
    }

    if (winnerParticipantIds.length === 0) {
      // Accumulate pot to next edition
      await this.accumulatePot(editionId, totalCents);
      return;
    }

    const share = Math.floor(totalCents / winnerParticipantIds.length);
    const remainder = totalCents % winnerParticipantIds.length;

    // Get winners ordered by joinedAt (oldest first) for remainder distribution
    const participants = await this.prisma.participant.findMany({
      where: { id: { in: winnerParticipantIds } },
      orderBy: { joinedAt: 'asc' },
    });

    for (let i = 0; i < participants.length; i++) {
      const amount = share + (i === 0 ? remainder : 0);
      await this.prisma.potLedger.create({
        data: {
          editionId,
          userId: participants[i].userId,
          type: 'PRIZE_PAYOUT',
          amountCents: amount,
          description: `Premio ganador: ${participants[i].userId}`,
        },
      });
    }

    this.logger.log(
      `Distributed ${totalCents} cents among ${participants.length} winners for edition ${editionId}`,
    );
  }

  private async accumulatePot(editionId: string, amountCents: number) {
    // Find the next edition in the same championship
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      select: { championshipId: true },
    });
    if (!edition) return;

    const nextEdition = await this.prisma.edition.findFirst({
      where: {
        championshipId: edition.championshipId,
        status: { in: ['DRAFT', 'OPEN'] },
        id: { not: editionId },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Record the accumulated-out for current edition
    await this.prisma.potLedger.create({
      data: {
        editionId,
        type: 'ACCUMULATED_OUT',
        amountCents,
        description: 'Bote acumulado para próxima edición',
      },
    });

    if (nextEdition) {
      await this.prisma.potLedger.create({
        data: {
          editionId: nextEdition.id,
          type: 'ACCUMULATED_IN',
          amountCents,
          description: `Bote acumulado de edición ${editionId}`,
        },
      });

      await this.prisma.edition.update({
        where: { id: nextEdition.id },
        data: { accumulatedPotCents: { increment: amountCents } },
      });
    }

    this.logger.log(`Pot of ${amountCents} cents accumulated from edition ${editionId}`);
  }
}
