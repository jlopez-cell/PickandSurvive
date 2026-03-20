import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChampionshipMode, MatchdayStatus, ParticipantStatus } from '@prisma/client';

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

    // Privacy: don't reveal picks (latestPick) before the matchday officially starts (deadline = first kickoff).
    let canRevealPicks = true;
    try {
      const matchday = await this.prisma.matchday.findFirst({
        where: {
          leagueId: edition.championship.footballLeagueId,
          season: edition.championship.footballLeague.currentSeason,
          number: {
            gte: edition.startMatchday,
            ...(edition.endMatchday !== null ? { lte: edition.endMatchday } : {}),
          },
          status: { in: [MatchdayStatus.SCHEDULED, MatchdayStatus.ONGOING] },
        },
        orderBy: { number: 'asc' },
      });

      let firstKickoff = matchday?.firstKickoff ?? null;
      if (matchday && !firstKickoff) {
        const firstMatch = await this.prisma.match.findFirst({
          where: { matchdayId: matchday.id },
          orderBy: { kickoffTime: 'asc' },
          select: { kickoffTime: true },
        });
        firstKickoff = firstMatch?.kickoffTime ?? null;
      }

      if (firstKickoff) {
        canRevealPicks = new Date(firstKickoff).getTime() <= Date.now();
      }
    } catch {
      // Si falla el cálculo, mejor no bloquear: devolvemos picks como antes.
      canRevealPicks = true;
    }

    const viewerParticipantId = participant?.id ?? null;

    const participants = await this.prisma.participant.findMany({
      where: { editionId },
      include: {
        user: { select: { alias: true } },
        picks: {
          orderBy: { matchday: { number: 'desc' } },
          take: 1,
          include: {
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
        .map((p) => ({
          participantId: p.id,
          alias: p.user.alias,
          status: p.status,
          eliminatedAtMatchday: p.eliminatedAtMatchday,
          latestPick:
            canRevealPicks || (viewerParticipantId && p.id === viewerParticipantId)
              ? p.picks[0] ?? null
              : null,
        }))
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
        .map((p) => ({
          participantId: p.id,
          alias: p.user.alias,
          totalPoints: p.totalPoints,
          latestPick:
            canRevealPicks || (viewerParticipantId && p.id === viewerParticipantId)
              ? p.picks[0] ?? null
              : null,
        }))
        .sort((a, b) => b.totalPoints - a.totalPoints);
    }
  }
}
