import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MatchStatus, ParticipantStatus } from '@prisma/client';

const WC_API_FOOTBALL_ID = 2000;
const WC_TEAM_ID_FACTOR = 1000000;
const WC_SEASON = 2026;

@Injectable()
export class WcPicksService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Jornada actual o próxima del Mundial ───────────────────────────────────
  // Retorna la jornada de hoy si hay partidos hoy, o la siguiente jornada
  // con partidos futuros (para permitir picks antes de que empiece el torneo).
  private async getCurrentMatchday(leagueId: string) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setUTCHours(23, 59, 59, 999);

    const today = await this.prisma.matchday.findFirst({
      where: {
        leagueId,
        season: WC_SEASON,
        matches: { some: { kickoffTime: { gte: todayStart, lte: todayEnd } } },
      },
      orderBy: { number: 'asc' },
    });
    if (today) return today;

    // Próxima jornada con partidos futuros
    return this.prisma.matchday.findFirst({
      where: {
        leagueId,
        season: WC_SEASON,
        matches: { some: { kickoffTime: { gt: now } } },
      },
      orderBy: { number: 'asc' },
    });
  }

  // ── GET /wc/editions/:id/today ─────────────────────────────────────────────
  // Devuelve: matchday actual, partidos de hoy con contexto de grupo, pick actual
  async getTodayContext(userId: string, editionId: string, matchdayNumber?: number) {
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

    const matchday = matchdayNumber
      ? await this.prisma.matchday.findFirst({
          where: { leagueId: league.id, season: WC_SEASON, number: matchdayNumber },
        })
      : await this.getCurrentMatchday(league.id);

    if (!matchday) {
      return {
        championshipName: edition.championship.name,
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

    const [prev, next] = await Promise.all([
      this.prisma.matchday.findFirst({
        where: { leagueId: league.id, season: WC_SEASON, number: { lt: matchday.number } },
        orderBy: { number: 'desc' },
        select: { number: true },
      }),
      this.prisma.matchday.findFirst({
        where: { leagueId: league.id, season: WC_SEASON, number: { gt: matchday.number } },
        orderBy: { number: 'asc' },
        select: { number: true },
      }),
    ]);

    return {
      championshipName: edition.championship.name,
      matchday: {
        id: matchday.id,
        number: matchday.number,
        status: matchday.status,
        tournamentPhase: matchday.tournamentPhase,
        wcGroupDay: matchday.wcGroupDay,
        firstKickoff: deadline,
        deadlinePassed,
        prevNumber: prev?.number ?? null,
        nextNumber: next?.number ?? null,
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
            pickType: pick.pickType,
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

    // Standings exist — return them as-is
    if (groups.length > 0) {
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

    // No standings yet (pre-tournament) — derive groups from match data
    const matches = await this.prisma.match.findMany({
      where: {
        matchday: { leagueId: league.id, season: WC_SEASON },
        wcGroup: { not: null },
      },
      include: {
        homeTeam: { select: { id: true, name: true, logoUrl: true } },
        awayTeam: { select: { id: true, name: true, logoUrl: true } },
      },
    });

    const groupMap = new Map<string, Map<string, { id: string; name: string; logoUrl: string }>>();
    for (const m of matches) {
      if (!m.wcGroup) continue;
      if (!groupMap.has(m.wcGroup)) groupMap.set(m.wcGroup, new Map());
      const gTeams = groupMap.get(m.wcGroup)!;
      gTeams.set(m.homeTeam.id, m.homeTeam);
      gTeams.set(m.awayTeam.id, m.awayTeam);
    }

    return [...groupMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, teamsMap]) => ({
        name,
        standings: [...teamsMap.values()].sort((a, b) => a.name.localeCompare(b.name)).map((team, i) => ({
          position: i + 1,
          team,
          played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
        })),
      }));
  }

  // ── GET /wc/editions/:id/history ──────────────────────────────────────────
  // Historial de ediciones finalizadas del mismo campeonato
  async getEditionHistory(editionId: string) {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      select: { championshipId: true },
    });
    if (!edition) throw new NotFoundException('Edición no encontrada');

    const finished = await this.prisma.edition.findMany({
      where: { championshipId: edition.championshipId, status: 'FINISHED' },
      select: {
        id: true,
        name: true,
        finishedAt: true,
        winner: { select: { alias: true } },
        _count: { select: { participants: true } },
      },
      orderBy: { finishedAt: 'desc' },
    });

    return finished.map((e) => ({
      id: e.id,
      name: e.name ?? `edicion_??`,
      finishedAt: e.finishedAt,
      winnerAlias: e.winner?.alias ?? null,
      participantCount: e._count.participants,
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
