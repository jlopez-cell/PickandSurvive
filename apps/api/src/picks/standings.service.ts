import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChallengeStatus, ChampionshipMode, MatchdayStatus, ParticipantStatus, PickStatus } from '@prisma/client';
import { findNextOpenMatchdayByCalendar } from '../matchdays/find-next-open-matchday-by-calendar';

/** Torneo: racha de victorias (SURVIVED). Ignora PENDING/POSTPONED sin romper la racha previa. */
function computeSurvivalStreak(
  picks: { status: PickStatus; matchday: { number: number } }[],
): number {
  const sorted = [...picks].sort((a, b) => b.matchday.number - a.matchday.number);
  let streak = 0;
  for (const pick of sorted) {
    if (pick.status === PickStatus.SURVIVED) {
      streak++;
    } else if (pick.status === PickStatus.PENDING || pick.status === PickStatus.POSTPONED_PENDING) {
      continue;
    } else {
      break;
    }
  }
  return streak;
}

/** Liga: racha de victorias (solo pointsAwarded === 3). */
function computeLeagueWinStreak(
  picks: {
    status: PickStatus;
    pointsAwarded: number | null;
    matchday: { number: number };
  }[],
): number {
  const sorted = [...picks].sort((a, b) => b.matchday.number - a.matchday.number);
  let streak = 0;
  for (const pick of sorted) {
    if (pick.pointsAwarded === 3) {
      streak++;
    } else if (pick.status === PickStatus.PENDING || pick.status === PickStatus.POSTPONED_PENDING) {
      continue;
    } else {
      break;
    }
  }
  return streak;
}

@Injectable()
export class StandingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStandings(userId: string, editionId: string) {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        championship: { include: { footballLeague: true } },
      },
    });

    if (!edition) throw new NotFoundException('Edición no encontrada');

    // Only participants (or admin) can view standings
    const participant = await this.prisma.participant.findUnique({
      where: { userId_editionId: { userId, editionId } },
    });

    const isAdmin = edition.championship.adminId === userId;
    if (!participant && !isAdmin) {
      throw new ForbiddenException('Solo los participantes pueden ver la clasificación');
    }

    const matchdayNumberFilter = {
      gte: edition.startMatchday,
      ...(edition.endMatchday !== null ? { lte: edition.endMatchday } : {}),
    };

    const leagueId = edition.championship.footballLeagueId;
    const season = edition.championship.footballLeague.currentSeason;

    // Misma jornada que GET /deadline (abierta más próxima en calendario). "Pick actual" = pick de esa jornada.
    let pickDisplayMatchdayNumber: number | null = null;
    let canRevealPicks = true;

    try {
      const deadlineMatchday = await findNextOpenMatchdayByCalendar(this.prisma, {
        leagueId,
        season,
        number: matchdayNumberFilter,
      });

      pickDisplayMatchdayNumber = deadlineMatchday?.number ?? null;

      let firstKickoff = deadlineMatchday?.firstKickoff ?? null;
      if (deadlineMatchday && !firstKickoff) {
        const firstMatch = await this.prisma.match.findFirst({
          where: { matchdayId: deadlineMatchday.id },
          orderBy: { kickoffTime: 'asc' },
          select: { kickoffTime: true },
        });
        firstKickoff = firstMatch?.kickoffTime ?? null;
      }

      if (firstKickoff) {
        canRevealPicks = new Date(firstKickoff).getTime() <= Date.now();
      }

      if (pickDisplayMatchdayNumber === null) {
        const lastFinished = await this.prisma.matchday.findFirst({
          where: {
            leagueId,
            season,
            number: matchdayNumberFilter,
            status: MatchdayStatus.FINISHED,
          },
          orderBy: { number: 'desc' },
        });
        pickDisplayMatchdayNumber = lastFinished?.number ?? null;
      }
    } catch {
      canRevealPicks = true;
      pickDisplayMatchdayNumber = null;
    }

    const viewerParticipantId = participant?.id ?? null;

    // Active tokens for current matchday
    let activeBlocks: Array<{ blockedParticipantId: string; blocker: { user: { alias: string } } }> = [];
    let activeVetos: Array<{ vetoedParticipantId: string; team: { name: string }; vetoer: { user: { alias: string } } }> = [];
    let activeChallenges: Array<{
      challengerParticipantId: string;
      challengedParticipantId: string;
      challenger: { user: { alias: string } };
      challenged: { user: { alias: string } };
    }> = [];

    if (pickDisplayMatchdayNumber !== null) {
      [activeBlocks, activeVetos, activeChallenges] = await Promise.all([
        this.prisma.block.findMany({
          where: { editionId, matchdayNumber: pickDisplayMatchdayNumber },
          include: { blocker: { include: { user: { select: { alias: true } } } } },
        }),
        this.prisma.veto.findMany({
          where: { editionId, matchdayNumber: pickDisplayMatchdayNumber },
          include: {
            team: { select: { name: true } },
            vetoer: { include: { user: { select: { alias: true } } } },
          },
        }),
        this.prisma.challenge.findMany({
          where: { editionId, matchdayNumber: pickDisplayMatchdayNumber, status: ChallengeStatus.ACTIVE },
          include: {
            challenger: { include: { user: { select: { alias: true } } } },
            challenged: { include: { user: { select: { alias: true } } } },
          },
        }),
      ]);
    }

    const resolvePickActual = (
      picks: {
        status: PickStatus;
        matchday: { number: number; status: MatchdayStatus };
        team: { id: string; name: string; logoUrl: string };
      }[],
    ) => {
      if (pickDisplayMatchdayNumber === null) return null;
      return picks.find((pk) => pk.matchday.number === pickDisplayMatchdayNumber) ?? null;
    };

    const participants = await this.prisma.participant.findMany({
      where: { editionId },
      include: {
        user: { select: { alias: true } },
        picks: {
          where: {
            matchday: {
              leagueId: edition.championship.footballLeagueId,
              season: edition.championship.footballLeague.currentSeason,
              number: matchdayNumberFilter,
            },
          },
          orderBy: { matchday: { number: 'desc' } },
          select: {
            status: true,
            pointsAwarded: true,
            isDoubleOrNothing: true,
            team: { select: { id: true, name: true, logoUrl: true } },
            matchday: { select: { number: true, status: true } },
          },
        },
      },
    });

    const mode = edition.championship.mode;

    if (mode === ChampionshipMode.TOURNAMENT) {
      // Sort: ACTIVE first (no eliminatedAtMatchday), then by eliminatedAtMatchday DESC
      return participants
        .map((p) => {
          const survivedPickCount = p.picks.filter((pk) => pk.status === PickStatus.SURVIVED).length;
          const survivalStreak = computeSurvivalStreak(p.picks);
          const currentPick = pickDisplayMatchdayNumber !== null
            ? p.picks.find((pk) => pk.matchday.number === pickDisplayMatchdayNumber) ?? null
            : null;
          const myBlock = activeBlocks.find((b) => b.blockedParticipantId === p.id);
          const myVeto = activeVetos.find((v) => v.vetoedParticipantId === p.id);
          const myChallenge = activeChallenges.find(
            (c) => c.challengerParticipantId === p.id || c.challengedParticipantId === p.id,
          );
          return {
            participantId: p.id,
            alias: p.user.alias,
            status: p.status,
            eliminatedAtMatchday: p.eliminatedAtMatchday,
            survivedPickCount,
            survivalStreak,
            isGhost: p.isGhost ?? false,
            blocksRemaining: p.blocksRemaining ?? 0,
            vetosRemaining: p.vetosRemaining ?? 0,
            challengesRemaining: p.challengesRemaining ?? 0,
            doubleOrNadaRemaining: p.doubleOrNadaRemaining ?? 0,
            latestPick:
              canRevealPicks || (viewerParticipantId && p.id === viewerParticipantId)
                ? resolvePickActual(p.picks)
                : null,
            // Active tokens — veto/challenge visible always; block/doubleOrNada only post-kickoff
            activeVeto: myVeto ? { teamName: myVeto.team.name, from: myVeto.vetoer.user.alias } : null,
            activeChallenge: myChallenge
              ? {
                  with:
                    myChallenge.challengerParticipantId === p.id
                      ? myChallenge.challenged.user.alias
                      : myChallenge.challenger.user.alias,
                }
              : null,
            isBlocked: canRevealPicks ? !!myBlock : false,
            blockFrom: canRevealPicks ? (myBlock?.blocker.user.alias ?? null) : null,
            doubleOrNadaActive: canRevealPicks ? (currentPick?.isDoubleOrNothing ?? false) : false,
          };
        })
        .sort((a, b) => {
          if (a.status === ParticipantStatus.ACTIVE && b.status !== ParticipantStatus.ACTIVE) return -1;
          if (a.status !== ParticipantStatus.ACTIVE && b.status === ParticipantStatus.ACTIVE) return 1;
          // Both active or both eliminated
          if (a.eliminatedAtMatchday !== null && b.eliminatedAtMatchday !== null) {
            return b.eliminatedAtMatchday - a.eliminatedAtMatchday;
          }
          return 0;
        });
    } else {
      // LEAGUE: sort by totalPoints DESC
      return participants
        .map((p) => {
          const survivedPickCount = p.picks.filter((pk) => pk.pointsAwarded === 3).length;
          const survivalStreak = computeLeagueWinStreak(p.picks);
          const currentPick = pickDisplayMatchdayNumber !== null
            ? p.picks.find((pk) => pk.matchday.number === pickDisplayMatchdayNumber) ?? null
            : null;
          const myBlock = activeBlocks.find((b) => b.blockedParticipantId === p.id);
          const myVeto = activeVetos.find((v) => v.vetoedParticipantId === p.id);
          const myChallenge = activeChallenges.find(
            (c) => c.challengerParticipantId === p.id || c.challengedParticipantId === p.id,
          );
          return {
            participantId: p.id,
            alias: p.user.alias,
            totalPoints: p.totalPoints,
            survivedPickCount,
            survivalStreak,
            isGhost: p.isGhost ?? false,
            blocksRemaining: p.blocksRemaining ?? 0,
            vetosRemaining: p.vetosRemaining ?? 0,
            challengesRemaining: p.challengesRemaining ?? 0,
            doubleOrNadaRemaining: p.doubleOrNadaRemaining ?? 0,
            latestPick:
              canRevealPicks || (viewerParticipantId && p.id === viewerParticipantId)
                ? resolvePickActual(p.picks)
                : null,
            // Active tokens — veto/challenge visible always; block/doubleOrNada only post-kickoff
            activeVeto: myVeto ? { teamName: myVeto.team.name, from: myVeto.vetoer.user.alias } : null,
            activeChallenge: myChallenge
              ? {
                  with:
                    myChallenge.challengerParticipantId === p.id
                      ? myChallenge.challenged.user.alias
                      : myChallenge.challenger.user.alias,
                }
              : null,
            isBlocked: canRevealPicks ? !!myBlock : false,
            blockFrom: canRevealPicks ? (myBlock?.blocker.user.alias ?? null) : null,
            doubleOrNadaActive: canRevealPicks ? (currentPick?.isDoubleOrNothing ?? false) : false,
          };
        })
        .sort((a, b) => b.totalPoints - a.totalPoints);
    }
  }
}
