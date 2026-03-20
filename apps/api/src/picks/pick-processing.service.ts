import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChampionshipMode,
  MatchStatus,
  MatchdayStatus,
  ParticipantStatus,
  PickStatus,
} from '@prisma/client';
import { EditionResolutionService } from './edition-resolution.service';

@Injectable()
export class PickProcessingService {
  private readonly logger = new Logger(PickProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly editionResolution: EditionResolutionService,
  ) {}

  /**
   * Called when a match result is finalized.
   * Processes all PENDING picks for teams in that match.
   */
  async processMatchResult(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        matchday: true,
        homeTeam: true,
        awayTeam: true,
        winnerTeam: true,
      },
    });

    if (!match || match.status !== MatchStatus.FINISHED) return;

    const pendingPicks = await this.prisma.pick.findMany({
      where: {
        matchdayId: match.matchdayId,
        status: PickStatus.PENDING,
        team: { id: { in: [match.homeTeamId, match.awayTeamId] } },
      },
      include: {
        participant: {
          include: {
            edition: {
              include: {
                championship: { select: { mode: true } },
              },
            },
          },
        },
      },
    });

    for (const pick of pendingPicks) {
      const mode = pick.participant.edition.championship.mode;
      const pickTeamWon = match.winnerTeamId === pick.teamId;
      const isDraw = match.winnerTeamId === null;

      if (mode === ChampionshipMode.TOURNAMENT) {
        if (pickTeamWon) {
          await this.prisma.pick.update({
            where: { id: pick.id },
            data: { status: PickStatus.SURVIVED },
          });
        } else {
          const eliminatedStatus = isDraw
            ? PickStatus.DRAW_ELIMINATED
            : PickStatus.LOSS_ELIMINATED;

          await this.prisma.$transaction([
            this.prisma.pick.update({
              where: { id: pick.id },
              data: { status: eliminatedStatus },
            }),
            this.prisma.participant.update({
              where: { id: pick.participantId },
              data: {
                status: ParticipantStatus.ELIMINATED,
                eliminatedAtMatchday: match.matchday.number,
              },
            }),
          ]);
        }
      } else {
        // LEAGUE mode: award points
        const points = pickTeamWon ? 3 : isDraw ? 1 : 0;
        await this.prisma.$transaction([
          this.prisma.pick.update({
            where: { id: pick.id },
            data: { status: PickStatus.SURVIVED, pointsAwarded: points },
          }),
          this.prisma.participant.update({
            where: { id: pick.participantId },
            data: { totalPoints: { increment: points } },
          }),
        ]);
      }
    }

    // After processing picks, check if any editions should end
    const affectedEditions = new Set(pendingPicks.map((p) => p.participant.editionId));
    for (const editionId of affectedEditions) {
      await this.editionResolution.checkEditionEnd(editionId);
    }
  }

  /**
   * Called at the firstKickoff of a matchday.
   * Eliminates (TOURNAMENT) or penalizes (LEAGUE) participants who haven't picked.
   */
  async processNoPickDeadline(matchdayId: string) {
    const matchday = await this.prisma.matchday.findUnique({ where: { id: matchdayId } });
    if (!matchday) return;

    // Find all ACTIVE editions whose championship uses this league
    const activeEditions = await this.prisma.edition.findMany({
      where: {
        status: 'ACTIVE',
        championship: { footballLeagueId: matchday.leagueId },
        startMatchday: { lte: matchday.number },
        OR: [{ endMatchday: null }, { endMatchday: { gte: matchday.number } }],
      },
      include: {
        championship: { select: { mode: true } },
        participants: {
          where: { status: ParticipantStatus.ACTIVE },
          include: {
            picks: {
              where: { matchdayId },
            },
          },
        },
      },
    });

    for (const edition of activeEditions) {
      for (const participant of edition.participants) {
        // Already has a pick
        if (participant.picks.length > 0) continue;

        if (edition.championship.mode === ChampionshipMode.TOURNAMENT) {
          await this.prisma.$transaction([
            this.prisma.pick.create({
              data: {
                participantId: participant.id,
                matchdayId,
                teamId: await this.getPlaceholderTeamId(edition.id),
                status: PickStatus.NO_PICK_ELIMINATED,
              },
            }),
            this.prisma.participant.update({
              where: { id: participant.id },
              data: {
                status: ParticipantStatus.ELIMINATED,
                eliminatedAtMatchday: matchday.number,
              },
            }),
          ]);
        } else {
          // LEAGUE: -1 point
          await this.prisma.participant.update({
            where: { id: participant.id },
            data: { totalPoints: { decrement: 1 } },
          });
        }
      }

      await this.editionResolution.checkEditionEnd(edition.id);
    }
  }

  /**
   * Returns a placeholder teamId for NO_PICK records in TOURNAMENT mode.
   * Uses any team from the league (the pick record is just a marker — team is irrelevant).
   */
  private async getPlaceholderTeamId(editionId: string): Promise<string> {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: { championship: { include: { footballLeague: { include: { teams: { take: 1 } } } } } },
    });
    const team = edition?.championship.footballLeague.teams[0];
    if (!team) throw new Error('No teams found in league');
    return team.id;
  }
}
