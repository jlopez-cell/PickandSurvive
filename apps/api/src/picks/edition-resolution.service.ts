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

    if (mode === ChampionshipMode.TOURNAMENT) {
      await this.checkTournamentEnd(edition);
    } else {
      await this.checkLeagueEnd(edition);
    }
  }

  private async checkTournamentEnd(edition: any) {
    const activeParticipants = edition.participants;

    if (activeParticipants.length <= 1) {
      const winnerIds = activeParticipants.map((p: any) => p.id);

      await this.prisma.edition.update({
        where: { id: edition.id },
        data: { status: EditionStatus.FINISHED, finishedAt: new Date() },
      });

      // If no one survived (all eliminated same round) → accumulate pot
      await this.potDistribution.distribute(edition.id, winnerIds);

      // Notify all participants
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
              winnerParticipantIds: winnerIds,
            },
          },
        });
      }

      this.logger.log(
        `Edition ${edition.id} FINISHED (TOURNAMENT). Winners: ${winnerIds.length}`,
      );
    }
  }

  private async checkLeagueEnd(edition: any) {
    if (!edition.endMatchday) return;

    // Check if the last matchday is done
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

    // Find winner(s): participants with highest points
    const allParticipants = await this.prisma.participant.findMany({
      where: { editionId: edition.id },
      orderBy: { totalPoints: 'desc' },
    });

    if (allParticipants.length === 0) return;

    const topScore = allParticipants[0].totalPoints;
    const winnerIds = allParticipants
      .filter((p) => p.totalPoints === topScore)
      .map((p) => p.id);

    await this.prisma.edition.update({
      where: { id: edition.id },
      data: { status: EditionStatus.FINISHED, finishedAt: new Date() },
    });

    await this.potDistribution.distribute(edition.id, winnerIds);

    for (const p of allParticipants) {
      await this.prisma.notification.create({
        data: {
          userId: p.userId,
          type: 'EDITION_FINISHED',
          payload: { editionId: edition.id, winnerParticipantIds: winnerIds },
        },
      });
    }

    this.logger.log(
      `Edition ${edition.id} FINISHED (LEAGUE). Top score: ${topScore}, Winners: ${winnerIds.length}`,
    );
  }
}
