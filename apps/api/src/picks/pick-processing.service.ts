import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChampionshipMode,
  ChallengeStatus,
  MatchStatus,
  MatchdayStatus,
  ParticipantStatus,
  PickStatus,
  PickType,
} from '@prisma/client';
import { EditionResolutionService } from './edition-resolution.service';
import { SocialService } from '../social/social.service';

@Injectable()
export class PickProcessingService {
  private readonly logger = new Logger(PickProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly editionResolution: EditionResolutionService,
    private readonly social: SocialService,
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
                championship: {
                  select: {
                    mode: true,
                    streakBonusEnabled: true,
                    wildcardCount: true,
                    ghostModeEnabled: true,
                    doubleOrNothingEnabled: true,
                    underdogBonusEnabled: true,
                    footballLeagueId: true,
                    footballLeague: {
                      select: {
                        currentSeason: true,
                        totalMatchdaysPerSeason: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    for (const pick of pendingPicks) {
      if (!pick.teamId) continue;

      const { participant } = pick;
      const championship = participant.edition.championship;
      const mode = championship.mode;
      const pickTeamWon = match.winnerTeamId === pick.teamId;
      const isDraw = match.winnerTeamId === null;

      if (
        participant.status === ParticipantStatus.ELIMINATED &&
        !participant.isGhost
      ) {
        continue;
      }

      if (mode === ChampionshipMode.TOURNAMENT || mode === ChampionshipMode.WORLD_CUP) {
        const winsOrDraw = pick.pickType === PickType.WIN_OR_DRAW;
        const survives = pickTeamWon || (winsOrDraw && isDraw);

        if (survives) {
          await this.prisma.pick.update({
            where: { id: pick.id },
            data: { status: PickStatus.SURVIVED },
          });
        } else if (participant.isGhost) {
          await this.prisma.pick.update({
            where: { id: pick.id },
            data: {
              status: isDraw ? PickStatus.DRAW_ELIMINATED : PickStatus.LOSS_ELIMINATED,
            },
          });
        } else if (participant.wildcardsRemaining > 0) {
          await this.prisma.$transaction(async (tx) => {
            await tx.participant.update({
              where: { id: pick.participantId },
              data: { wildcardsRemaining: { decrement: 1 } },
            });
            await tx.pick.update({
              where: { id: pick.id },
              data: { status: PickStatus.SURVIVED },
            });
            await tx.notification.create({
              data: {
                userId: participant.userId,
                type: 'PICK_REMINDER',
                payload: {
                  wildcardUsed: true,
                  wildcardsRemaining: participant.wildcardsRemaining - 1,
                },
              },
            });
          });
        } else {
          const eliminatedStatus = isDraw
            ? PickStatus.DRAW_ELIMINATED
            : PickStatus.LOSS_ELIMINATED;

          const participantUpdateData: Record<string, unknown> = {
            status: ParticipantStatus.ELIMINATED,
            eliminatedAtMatchday: match.matchday.number,
            ...(mode === ChampionshipMode.WORLD_CUP && {
              eliminatedAtPhase: match.tournamentPhase ?? undefined,
            }),
          };

          if (championship.ghostModeEnabled) {
            participantUpdateData.isGhost = true;
          }

          await this.prisma.$transaction([
            this.prisma.pick.update({
              where: { id: pick.id },
              data: { status: eliminatedStatus },
            }),
            this.prisma.participant.update({
              where: { id: pick.participantId },
              data: participantUpdateData,
            }),
          ]);
        }
      } else {
        // LEAGUE mode: award points
        let basePoints: number;
        if (pick.isDoubleOrNothing) {
          basePoints = pickTeamWon ? 6 : isDraw ? 1 : -3;
        } else {
          basePoints = pickTeamWon ? 3 : isDraw ? 1 : 0;
        }

        let streakBonus = 0;
        if (championship.streakBonusEnabled && pickTeamWon && !pick.isDoubleOrNothing) {
          const recentPicks = await this.prisma.pick.findMany({
            where: {
              participantId: pick.participantId,
              status: PickStatus.SURVIVED,
            },
            orderBy: { matchday: { number: 'desc' } },
            select: { pointsAwarded: true },
          });

          let streak = 1;
          for (const p of recentPicks) {
            if (p.pointsAwarded === 3) streak++;
            else break;
          }

          if (streak >= 8) streakBonus = 3;
          else if (streak >= 5) streakBonus = 1;
        }

        let underdogBonusFlag = false;
        if (championship.underdogBonusEnabled && pickTeamWon) {
          const fl = championship.footballLeague;
          const threshold = fl.totalMatchdaysPerSeason * 0.35;
          const teamWins = await this.prisma.match.count({
            where: {
              matchday: {
                leagueId: championship.footballLeagueId,
                season: fl.currentSeason,
              },
              winnerTeamId: pick.teamId,
            },
          });
          if (teamWins < threshold) {
            underdogBonusFlag = true;
          }
        }

        const totalIncrement = basePoints + streakBonus + (underdogBonusFlag ? 1 : 0);

        await this.prisma.$transaction(async (tx) => {
          await tx.pick.update({
            where: { id: pick.id },
            data: {
              status: PickStatus.SURVIVED,
              pointsAwarded: basePoints,
              streakBonusPoints: streakBonus,
              underdogBonus: underdogBonusFlag,
            },
          });
          await tx.participant.update({
            where: { id: pick.participantId },
            data: { totalPoints: { increment: totalIncrement } },
          });

          const block = await tx.block.findFirst({
            where: {
              editionId: participant.editionId,
              blockedParticipantId: participant.id,
              matchdayNumber: match.matchday.number,
            },
          });
          if (block) {
            await tx.participant.update({
              where: { id: participant.id },
              data: { totalPoints: { decrement: totalIncrement } },
            });
            await tx.pick.update({
              where: { id: pick.id },
              data: { pointsAwarded: 0, streakBonusPoints: 0, underdogBonus: false },
            });
          }
        });
      }
    }

    // Resolve active challenges where both picks are now processed
    const matchdayNumber = match.matchday.number;
    const affectedEditionIds = [...new Set(pendingPicks.map((p) => p.participant.editionId))];
    for (const editionId of affectedEditionIds) {
      await this.prisma.$transaction(async (tx) => {
        const challenges = await tx.challenge.findMany({
          where: { editionId, matchdayNumber, status: ChallengeStatus.ACTIVE },
        });

        for (const ch of challenges) {
          const [challengerPick, challengedPick] = await Promise.all([
            tx.pick.findFirst({
              where: {
                participantId: ch.challengerParticipantId,
                matchday: { number: ch.matchdayNumber },
              },
            }),
            tx.pick.findFirst({
              where: {
                participantId: ch.challengedParticipantId,
                matchday: { number: ch.matchdayNumber },
              },
            }),
          ]);

          if (
            challengerPick &&
            challengedPick &&
            challengerPick.status !== PickStatus.PENDING &&
            challengedPick.status !== PickStatus.PENDING
          ) {
            await this.social.resolveChallenge(ch.id, tx);
          }
        }
      });
    }

    for (const editionId of affectedEditionIds) {
      await this.editionResolution.checkEditionEnd(editionId);
    }
  }

  /**
   * Called at the firstKickoff of a matchday.
   * Eliminates (TOURNAMENT) or penalizes (LEAGUE) participants who haven't picked.
   */
  // batchMatchdayIds: when multiple matchdays accumulated (server down), picks for ANY day in the batch protect the player.
  async processNoPickDeadline(matchdayId: string, batchMatchdayIds: string[] = [matchdayId]) {
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
              where: { matchdayId: { in: batchMatchdayIds } },
            },
          },
        },
      },
    });

    for (const edition of activeEditions) {
      for (const participant of edition.participants) {
        // Already has a pick
        if (participant.picks.length > 0) continue;

        const isSurvivalMode =
          edition.championship.mode === ChampionshipMode.TOURNAMENT ||
          edition.championship.mode === ChampionshipMode.WORLD_CUP;

        if (isSurvivalMode) {
          await this.prisma.$transaction([
            this.prisma.pick.create({
              data: {
                participantId: participant.id,
                matchdayId,
                teamId: null,
                status: PickStatus.NO_PICK_ELIMINATED,
              },
            }),
            this.prisma.participant.update({
              where: { id: participant.id },
              data: {
                status: ParticipantStatus.ELIMINATED,
                eliminatedAtMatchday: matchday.number,
                ...(edition.championship.mode === ChampionshipMode.WORLD_CUP && {
                  eliminatedAtPhase: matchday.tournamentPhase ?? undefined,
                }),
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
}
