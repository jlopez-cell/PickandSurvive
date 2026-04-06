import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChampionshipMode, MatchdayStatus, ParticipantStatus, PickStatus } from '@prisma/client';

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

    // Misma jornada que GET /deadline (primera SCHEDULED|ONGOING). "Pick actual" = pick de esa jornada,
    // no el de la jornada más alta (evita mostrar J30 mientras la vigente en UI es J29).
    let pickDisplayMatchdayNumber: number | null = null;
    let canRevealPicks = true;

    try {
      const deadlineMatchday = await this.prisma.matchday.findFirst({
        where: {
          leagueId,
          season,
          number: matchdayNumberFilter,
          status: { in: [MatchdayStatus.SCHEDULED, MatchdayStatus.ONGOING] },
        },
        orderBy: { number: 'asc' },
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
          return {
            participantId: p.id,
            alias: p.user.alias,
            status: p.status,
            eliminatedAtMatchday: p.eliminatedAtMatchday,
            survivedPickCount,
            survivalStreak,
            latestPick:
              canRevealPicks || (viewerParticipantId && p.id === viewerParticipantId)
                ? resolvePickActual(p.picks)
                : null,
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
          return {
            participantId: p.id,
            alias: p.user.alias,
            totalPoints: p.totalPoints,
            survivedPickCount,
            survivalStreak,
            latestPick:
              canRevealPicks || (viewerParticipantId && p.id === viewerParticipantId)
                ? resolvePickActual(p.picks)
                : null,
          };
        })
        .sort((a, b) => b.totalPoints - a.totalPoints);
    }
  }
}
