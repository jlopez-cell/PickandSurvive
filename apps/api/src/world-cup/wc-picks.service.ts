import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MatchStatus, ParticipantStatus } from '@prisma/client';

const WC_API_FOOTBALL_ID = 2000;
const WC_TEAM_ID_FACTOR = 1000000;
const WC_SEASON = 2026;

@Injectable()
export class WcPicksService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Matchday de hoy para el Mundial ────────────────────────────────────────
  private async getTodayMatchday(leagueId: string) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setUTCHours(23, 59, 59, 999);

    return this.prisma.matchday.findFirst({
      where: {
        leagueId,
        season: WC_SEASON,
        matches: {
          some: {
            kickoffTime: { gte: todayStart, lte: todayEnd },
          },
        },
      },
      orderBy: { number: 'asc' },
    });
  }

  // ── GET /wc/editions/:id/today ─────────────────────────────────────────────
  // Devuelve: matchday actual, partidos de hoy con contexto de grupo, pick actual
  async getTodayContext(userId: string, editionId: string) {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        championship: {
          include: { footballLeague: true },
        },
      },
    });

    if (!edition) throw new NotFoundException('Edición no encontrada');

    const league = edition.championship.footballLeague;
    if (league.apiFootballId !== WC_API_FOOTBALL_ID) {
      throw new ForbiddenException('Esta edición no es del Mundial');
    }

    const participant = await this.prisma.participant.findUnique({
      where: { userId_editionId: { userId, editionId } },
    });
    if (!participant) throw new ForbiddenException('No eres participante de esta edición');

    const matchday = await this.getTodayMatchday(league.id);

    if (!matchday) {
      return {
        matchday: null,
        matches: [],
        myPick: null,
        participant: {
          status: participant.status,
          eliminatedAtPhase: participant.eliminatedAtPhase,
        },
      };
    }

    // Equipos ya usados por este participante
    const usedUsages = await this.prisma.teamUsage.findMany({
      where: { participantId: participant.id, editionId },
      select: { teamId: true },
    });
    const usedTeamIds = new Set(usedUsages.map((u) => u.teamId));

    const matches = await this.prisma.match.findMany({
      where: { matchdayId: matchday.id },
      include: {
        homeTeam: { select: { id: true, name: true, logoUrl: true } },
        awayTeam: { select: { id: true, name: true, logoUrl: true } },
      },
      orderBy: { kickoffTime: 'asc' },
    });

    // Pick del usuario para esta jornada
    const pick = await this.prisma.pick.findUnique({
      where: { participantId_matchdayId: { participantId: participant.id, matchdayId: matchday.id } },
      include: { team: { select: { id: true, name: true, logoUrl: true } } },
    });

    const deadline = matchday.firstKickoff ?? matches[0]?.kickoffTime ?? null;
    const deadlinePassed = deadline ? new Date() >= deadline : false;

    return {
      matchday: {
        id: matchday.id,
        number: matchday.number,
        status: matchday.status,
        tournamentPhase: matchday.tournamentPhase,
        wcGroupDay: matchday.wcGroupDay,
        firstKickoff: deadline,
        deadlinePassed,
      },
      matches: matches.map((m) => ({
        id: m.id,
        status: m.status,
        kickoffTime: m.kickoffTime,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        wcGroup: m.wcGroup,
        tournamentPhase: m.tournamentPhase,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        homeUsed: usedTeamIds.has(m.homeTeamId),
        awayUsed: usedTeamIds.has(m.awayTeamId),
      })),
      myPick: pick
        ? {
            id: pick.id,
            status: pick.status,
            team: pick.team,
          }
        : null,
      participant: {
        status: participant.status,
        eliminatedAtPhase: participant.eliminatedAtPhase,
      },
    };
  }

  // ── GET /wc/editions/:id/groups ────────────────────────────────────────────
  // Devuelve las tablas de todos los grupos
  async getGroupStandings(editionId: string) {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: { championship: { include: { footballLeague: true } } },
    });

    if (!edition) throw new NotFoundException('Edición no encontrada');

    const league = edition.championship.footballLeague;
    if (league.apiFootballId !== WC_API_FOOTBALL_ID) {
      throw new ForbiddenException('Esta edición no es del Mundial');
    }

    const groups = await this.prisma.wcGroup.findMany({
      where: { leagueId: league.id, season: WC_SEASON },
      include: {
        standings: {
          include: {
            team: { select: { id: true, name: true, logoUrl: true } },
          },
          orderBy: [{ points: 'desc' }, { goalsFor: 'desc' }],
        },
      },
      orderBy: { name: 'asc' },
    });

    return groups.map((g) => ({
      name: g.name,
      standings: g.standings.map((s) => ({
        position: s.position,
        team: s.team,
        played: s.played,
        won: s.won,
        drawn: s.drawn,
        lost: s.lost,
        goalsFor: s.goalsFor,
        goalsAgainst: s.goalsAgainst,
        points: s.points,
      })),
    }));
  }

  // ── GET /wc/editions/:id/participants ──────────────────────────────────────
  // Estado de todos los participantes (para ranking WC)
  async getParticipants(editionId: string) {
    const participants = await this.prisma.participant.findMany({
      where: { editionId },
      include: {
        user: { select: { alias: true } },
        picks: {
          orderBy: { matchday: { number: 'desc' } },
          take: 1,
          include: { team: { select: { name: true, logoUrl: true } } },
        },
      },
      orderBy: [{ status: 'asc' }, { joinedAt: 'asc' }],
    });

    return participants.map((p) => ({
      alias: p.user.alias,
      status: p.status,
      eliminatedAtPhase: p.eliminatedAtPhase,
      lastPick: p.picks[0]
        ? { team: p.picks[0].team, pickStatus: p.picks[0].status }
        : null,
    }));
  }
}
