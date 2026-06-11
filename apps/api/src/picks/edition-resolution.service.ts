import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChampionshipMode,
  EditionStatus,
  MatchdayStatus,
  ParticipantStatus,
} from '@prisma/client';
import { PotDistributionService } from './pot-distribution.service';

@Injectable()
export class EditionResolutionService {
  private readonly logger = new Logger(EditionResolutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly potDistribution: PotDistributionService,
  ) {}

  /**
   * After each pick processing cycle, check if the edition should end.
   * TOURNAMENT: ≤1 active participant
   * LEAGUE: last matchday is FINISHED
   */
  async checkEditionEnd(editionId: string) {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        championship: {
          include: {
            footballLeague: { select: { id: true, currentSeason: true } },
          },
        },
        participants: { where: { status: ParticipantStatus.ACTIVE } },
      },
    });

    if (!edition || edition.status !== EditionStatus.ACTIVE) return;

    const mode = edition.championship.mode;

    if (mode === ChampionshipMode.TOURNAMENT || mode === ChampionshipMode.WORLD_CUP) {
      await this.checkTournamentEnd(edition);
    } else {
      await this.checkLeagueEnd(edition);
    }
  }

  private async checkTournamentEnd(edition: any) {
    const activeParticipants = edition.participants;

    if (activeParticipants.length > 1) return;

    const winnerIds = activeParticipants.map((p: any) => p.id);
    // Single survivor → winner; 0 survivors → no winner (all eliminated same round)
    const winnerUserId: string | null =
      activeParticipants.length === 1 ? activeParticipants[0].userId : null;

    // Count already-finished editions for sequential naming (before marking this one)
    const finishedCount = await this.prisma.edition.count({
      where: { championshipId: edition.championshipId, status: EditionStatus.FINISHED },
    });
    const editionName = `edicion_${String(finishedCount + 1).padStart(2, '0')}`;

    await this.prisma.edition.update({
      where: { id: edition.id },
      data: {
        status: EditionStatus.FINISHED,
        finishedAt: new Date(),
        name: editionName,
        winnerUserId,
      },
    });

    await this.potDistribution.distribute(edition.id, winnerIds);

    const allParticipants = await this.prisma.participant.findMany({
      where: { editionId: edition.id },
      select: { userId: true },
    });

    for (const p of allParticipants) {
      await this.prisma.notification.create({
        data: {
          userId: p.userId,
          type: 'EDITION_FINISHED',
          payload: {
            editionId: edition.id,
            editionName,
            winnerUserId,
            winnerParticipantIds: winnerIds,
          },
        },
      });
    }

    this.logger.log(
      `Edition ${edition.id} "${editionName}" FINISHED. Winner: ${winnerUserId ?? 'none'}`,
    );

    // WORLD_CUP: auto-create next edition so the game continues without admin action
    if (edition.championship.mode === ChampionshipMode.WORLD_CUP) {
      await this.createNextWcEdition(
        edition,
        allParticipants.map((p) => p.userId),
      );
    }
  }

  /**
   * Finds the next unfinished WC matchday and creates an ACTIVE edition with
   * all participants from the finished one. Admin intervention not required.
   */
  private async createNextWcEdition(edition: any, userIds: string[]) {
    const leagueId = edition.championship.footballLeague.id;

    const nextMatchday = await this.prisma.matchday.findFirst({
      where: { leagueId, status: { not: MatchdayStatus.FINISHED } },
      orderBy: { number: 'asc' },
    });

    if (!nextMatchday) {
      this.logger.log(
        `WC championship ${edition.championshipId}: no more matchdays — skipping auto-next edition.`,
      );
      return;
    }

    const newEdition = await this.prisma.edition.create({
      data: {
        championshipId: edition.championshipId,
        startMatchday: nextMatchday.number,
        status: EditionStatus.ACTIVE,
      },
    });

    if (userIds.length > 0) {
      await this.prisma.participant.createMany({
        data: userIds.map((userId) => ({ userId, editionId: newEdition.id })),
        skipDuplicates: true,
      });
    }

    this.logger.log(
      `WC auto-next edition ${newEdition.id} created (startMatchday ${nextMatchday.number}, ${userIds.length} participants).`,
    );
  }

  private async checkLeagueEnd(edition: any) {
    if (!edition.endMatchday) return;

    const lastMatchday = await this.prisma.matchday.findUnique({
      where: {
        leagueId_season_number: {
          leagueId: edition.championship.footballLeague.id,
          season: edition.championship.footballLeague.currentSeason,
          number: edition.endMatchday,
        },
      },
    });

    if (!lastMatchday || lastMatchday.status !== MatchdayStatus.FINISHED) return;

    const allParticipants = await this.prisma.participant.findMany({
      where: { editionId: edition.id },
      orderBy: { totalPoints: 'desc' },
    });

    if (allParticipants.length === 0) return;

    const topScore = allParticipants[0].totalPoints;
    const winnerIds = allParticipants
      .filter((p) => p.totalPoints === topScore)
      .map((p) => p.id);

    // Count already-finished editions for sequential naming
    const finishedCount = await this.prisma.edition.count({
      where: { championshipId: edition.championshipId, status: EditionStatus.FINISHED },
    });
    const editionName = `edicion_${String(finishedCount + 1).padStart(2, '0')}`;

    await this.prisma.edition.update({
      where: { id: edition.id },
      data: {
        status: EditionStatus.FINISHED,
        finishedAt: new Date(),
        name: editionName,
      },
    });

    await this.potDistribution.distribute(edition.id, winnerIds);

    for (const p of allParticipants) {
      await this.prisma.notification.create({
        data: {
          userId: p.userId,
          type: 'EDITION_FINISHED',
          payload: { editionId: edition.id, editionName, winnerParticipantIds: winnerIds },
        },
      });
    }

    this.logger.log(
      `Edition ${edition.id} "${editionName}" FINISHED (LEAGUE). Top score: ${topScore}, Winners: ${winnerIds.length}`,
    );
  }
}
