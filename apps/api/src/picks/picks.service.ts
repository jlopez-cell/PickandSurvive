import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePickDto } from './dto/create-pick.dto';
import {
  EditionStatus,
  MatchdayStatus,
  ParticipantStatus,
  PickHalf,
  PickStatus,
} from '@prisma/client';
import { findNextOpenMatchdayByCalendar } from '../matchdays/find-next-open-matchday-by-calendar';

@Injectable()
export class PicksService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve la mitad (FIRST / SECOND) según `pickResetAtMidseason`.
   */
  private async resolvePickHalf(editionId: string, matchdayNumber: number): Promise<PickHalf> {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        championship: {
          include: { footballLeague: { select: { totalMatchdaysPerSeason: true } } },
        },
      },
    });

    if (!edition) throw new NotFoundException('Edición no encontrada');

    const { pickResetAtMidseason } = edition.championship;
    const total = edition.championship.footballLeague.totalMatchdaysPerSeason;

    if (pickResetAtMidseason && matchdayNumber > Math.floor(total / 2)) return PickHalf.SECOND;
    return PickHalf.FIRST;
  }

  // ─── Create Pick / Modify Pick ──────────────────────────────────────────

  async createPick(userId: string, editionId: string, dto: CreatePickDto) {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        championship: {
          select: { mode: true, footballLeagueId: true, pickResetAtMidseason: true },
        },
      },
    });

    if (!edition) throw new NotFoundException('Edición no encontrada');

    if (edition.status !== EditionStatus.ACTIVE && edition.status !== EditionStatus.OPEN) {
      throw new ForbiddenException('La edición no está disponible para picks');
    }

    const participant = await this.prisma.participant.findUnique({
      where: { userId_editionId: { userId, editionId } },
    });
    if (!participant) throw new ForbiddenException('No eres participante de esta edición');
    if (participant.status === ParticipantStatus.ELIMINATED) {
      throw new ForbiddenException('Estás eliminado de esta edición');
    }

    const league = await this.prisma.footballLeague.findUnique({
      where: { id: edition.championship.footballLeagueId },
      select: { currentSeason: true },
    });
    if (!league) throw new NotFoundException('Liga no encontrada');

    // Resolver matchday (o crear si no existe).
    const matchday =
      (await this.prisma.matchday.findUnique({
        where: {
          leagueId_season_number: {
            leagueId: edition.championship.footballLeagueId,
            season: league.currentSeason,
            number: dto.matchdayNumber,
          },
        },
      })) ??
      (await this.prisma.matchday.create({
        data: {
          leagueId: edition.championship.footballLeagueId,
          season: league.currentSeason,
          number: dto.matchdayNumber,
        },
      }));

    if (matchday.status !== MatchdayStatus.SCHEDULED && matchday.status !== MatchdayStatus.ONGOING) {
      throw new BadRequestException('La jornada no está disponible para picks');
    }

    // Hard deadline: once first kickoff has passed, picks cannot be created or modified.
    let firstKickoff = matchday.firstKickoff ?? null;
    if (!firstKickoff) {
      const firstMatch = await this.prisma.match.findFirst({
        where: { matchdayId: matchday.id },
        orderBy: { kickoffTime: 'asc' },
        select: { kickoffTime: true },
      });
      firstKickoff = firstMatch?.kickoffTime ?? null;
    }
    if (firstKickoff && new Date(firstKickoff).getTime() <= Date.now()) {
      throw new BadRequestException('La deadline de esta jornada ya ha pasado. No puedes cambiar tu pick.');
    }

    // Comprobar que el equipo pertenece a la liga.
    const team = await this.prisma.footballTeam.findFirst({
      where: { id: dto.teamId, leagueId: edition.championship.footballLeagueId },
    });
    if (!team) throw new BadRequestException('El equipo no pertenece a la liga de este campeonato');

    // Comprobar que el equipo juega en esa jornada.
    const teamPlaysMatch = await this.prisma.match.findFirst({
      where: {
        matchdayId: matchday.id,
        OR: [{ homeTeamId: dto.teamId }, { awayTeamId: dto.teamId }],
      },
      select: { id: true },
    });
    if (!teamPlaysMatch) throw new BadRequestException('El equipo no juega en esta jornada');

    const half = await this.resolvePickHalf(editionId, matchday.number);

    const existingPick = await this.prisma.pick.findUnique({
      where: { participantId_matchdayId: { participantId: participant.id, matchdayId: matchday.id } },
      select: { id: true, teamId: true, status: true },
    });

    const teamUsed = await this.prisma.teamUsage.findUnique({
      where: {
        participantId_teamId_editionId_half: {
          participantId: participant.id,
          teamId: dto.teamId,
          editionId,
          half,
        },
      },
    });

    const choosingSameTeam = existingPick?.teamId === dto.teamId;
    if (teamUsed && !choosingSameTeam) {
      throw new BadRequestException('Este equipo ya fue usado en esta vuelta');
    }

    // Si no existe pick previo, crear pick y TeamUsage.
    if (!existingPick) {
      await this.prisma.$transaction([
        this.prisma.pick.create({
          data: {
            participantId: participant.id,
            matchdayId: matchday.id,
            teamId: dto.teamId,
            status: PickStatus.PENDING,
            pickType: dto.pickType ?? 'WIN',
          },
        }),
        this.prisma.teamUsage.create({
          data: {
            participantId: participant.id,
            teamId: dto.teamId,
            editionId,
            half,
          },
        }),
      ]);

      return { message: 'Pick registrado correctamente.' };
    }

    // Modificar pick existente.
    if (existingPick.status !== PickStatus.PENDING) {
      throw new ConflictException('No puedes modificar un pick ya procesado');
    }

    const oldTeamId = existingPick.teamId;
    if (!oldTeamId) {
      throw new ConflictException('Pick sin equipo; no se puede modificar');
    }

    const txOps: any[] = [
      this.prisma.pick.update({
        where: { id: existingPick.id },
        data: { teamId: dto.teamId, status: PickStatus.PENDING, pointsAwarded: null, pickType: dto.pickType ?? 'WIN' },
      }),
    ];

    if (oldTeamId !== dto.teamId) {
      txOps.push(
        this.prisma.teamUsage.delete({
          where: {
            participantId_teamId_editionId_half: {
              participantId: participant.id,
              teamId: oldTeamId,
              editionId,
              half,
            },
          },
        }),
      );

      txOps.push(
        this.prisma.teamUsage.create({
          data: {
            participantId: participant.id,
            teamId: dto.teamId,
            editionId,
            half,
          },
        }),
      );
    }

    await this.prisma.$transaction(txOps);

    return {
      message: oldTeamId === dto.teamId ? 'Pick actualizado correctamente.' : 'Pick modificado correctamente.',
    };
  }

  // ─── Get Picks for Matchday ─────────────────────────────────────────────

  async getPicksForMatchday(userId: string, editionId: string, matchdayNumber: number) {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        championship: { include: { footballLeague: { select: { currentSeason: true } } } },
      },
    });

    if (!edition) throw new NotFoundException('Edición no encontrada');

    const participant = await this.prisma.participant.findUnique({
      where: { userId_editionId: { userId, editionId } },
    });
    if (!participant) return { myPick: null };

    const matchday = await this.prisma.matchday.findUnique({
      where: {
        leagueId_season_number: {
          leagueId: edition.championship.footballLeagueId,
          season: edition.championship.footballLeague.currentSeason,
          number: matchdayNumber,
        },
      },
    });

    if (!matchday) return { myPick: null };

    const pick = await this.prisma.pick.findUnique({
      where: { participantId_matchdayId: { participantId: participant.id, matchdayId: matchday.id } },
      include: {
        team: { select: { id: true, name: true, logoUrl: true } },
        participant: { include: { user: { select: { alias: true } } } },
        matchday: { select: { number: true, status: true } },
      },
    });

    if (!pick) return { myPick: null };

    return {
      myPick: {
        id: pick.id,
        status: pick.status,
        team: pick.status === PickStatus.NO_PICK_ELIMINATED || !pick.team ? null : pick.team,
        participant: pick.participant,
        matchday: pick.matchday,
      },
    };
  }

  // ─── Picks History ──────────────────────────────────────────────────────

  async getPicksHistory(userId: string, editionId: string) {
    const participant = await this.prisma.participant.findUnique({
      where: { userId_editionId: { userId, editionId } },
      select: { id: true },
    });

    if (!participant) return [];

    const picks = await this.prisma.pick.findMany({
      where: { participantId: participant.id },
      include: {
        team: { select: { name: true, logoUrl: true } },
        matchday: { select: { number: true, status: true } },
        participant: { include: { user: { select: { alias: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return picks.map((p) => ({
      id: p.id,
      status: p.status,
      pointsAwarded: p.pointsAwarded,
      team: p.status === PickStatus.NO_PICK_ELIMINATED || !p.team ? null : p.team,
      matchday: p.matchday,
      participant: { user: { alias: p.participant.user.alias } },
    }));
  }

  /**
   * Picks de todos los participantes en el rango de la edición.
   * Reglas de revelado alineadas con la clasificación: jornadas ya finalizadas siempre;
   * jornada abierta solo todos los picks tras el primer pitido, salvo el propio usuario.
   */
  async getEveryonePicksHistory(userId: string, editionId: string) {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        championship: { include: { footballLeague: true } },
      },
    });

    if (!edition) throw new NotFoundException('Edición no encontrada');

    const participant = await this.prisma.participant.findUnique({
      where: { userId_editionId: { userId, editionId } },
    });

    const isAdmin = edition.championship.adminId === userId;
    if (!participant && !isAdmin) {
      throw new ForbiddenException('Solo los participantes pueden ver esta información');
    }

    const matchdayNumberFilter = {
      gte: edition.startMatchday,
      ...(edition.endMatchday !== null ? { lte: edition.endMatchday } : {}),
    };

    const leagueId = edition.championship.footballLeagueId;
    const season = edition.championship.footballLeague.currentSeason;

    const picks = await this.prisma.pick.findMany({
      where: {
        participant: { editionId },
        matchday: {
          leagueId,
          season,
          number: matchdayNumberFilter,
        },
      },
      include: {
        participant: {
          include: { user: { select: { alias: true } } },
        },
        team: { select: { id: true, name: true, logoUrl: true } },
        matchday: { select: { number: true, status: true, firstKickoff: true } },
      },
      orderBy: [{ matchday: { number: 'desc' } }, { participant: { user: { alias: 'asc' } } }],
    });

    const now = Date.now();
    const visible = picks.filter((p) => {
      if (p.matchday.status === MatchdayStatus.FINISHED) return true;
      if (p.matchday.status === MatchdayStatus.ONGOING) return true;
      if (p.matchday.firstKickoff && new Date(p.matchday.firstKickoff).getTime() <= now) return true;
      return p.participant.userId === userId;
    });

    return visible.map((p) => ({
      id: p.id,
      pickStatus: p.status,
      pointsAwarded: p.pointsAwarded,
      matchdayNumber: p.matchday.number,
      matchdayStatus: p.matchday.status,
      alias: p.participant.user.alias,
      team:
        p.status === PickStatus.NO_PICK_ELIMINATED || !p.team
          ? null
          : { id: p.team.id, name: p.team.name, logoUrl: p.team.logoUrl },
    }));
  }

  // ─── Edition meta ───────────────────────────────────────────────────────

  async getEditionMeta(editionId: string) {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        championship: { include: { footballLeague: { select: { currentSeason: true } } } },
      },
    });

    if (!edition) throw new NotFoundException('Edición no encontrada');

    return {
      id: editionId,
      startMatchday: edition.startMatchday,
      endMatchday: edition.endMatchday,
      status: edition.status,
      championshipName: edition.championship.name,
      season: edition.championship.footballLeague.currentSeason,
    };
  }

  // ─── Get Match Calendar for Matchday ────────────────────────────────────

  async getMatchesForMatchday(userId: string, editionId: string, matchdayNumber: number) {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        championship: {
          include: { footballLeague: { select: { currentSeason: true, totalMatchdaysPerSeason: true } } },
        },
      },
    });

    if (!edition) throw new NotFoundException('Edición no encontrada');

    const participant = await this.prisma.participant.findUnique({
      where: { userId_editionId: { userId, editionId } },
    });
    if (!participant) throw new ForbiddenException('No eres participante de esta edición');

    const { pickResetAtMidseason } = edition.championship;
    const total = edition.championship.footballLeague.totalMatchdaysPerSeason;
    const half: PickHalf =
      pickResetAtMidseason && matchdayNumber > Math.floor(total / 2) ? PickHalf.SECOND : PickHalf.FIRST;

    const matchday = await this.prisma.matchday.findUnique({
      where: {
        leagueId_season_number: {
          leagueId: edition.championship.footballLeagueId,
          season: edition.championship.footballLeague.currentSeason,
          number: matchdayNumber,
        },
      },
    });

    if (!matchday) throw new NotFoundException('Jornada no encontrada');

    // Equipos ya usados por ESTE participante en la mitad actual (TeamUsage es por usuario).
    // Siempre lo enviamos: antes del pitido inicial el jugador debe ver qué no puede volver a elegir.
    const usedUsages = await this.prisma.teamUsage.findMany({
      where: { participantId: participant.id, editionId, half },
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

    return matches.map((m) => ({
      id: m.id,
      status: m.status,
      kickoffTime: m.kickoffTime,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeUsed: usedTeamIds.has(m.homeTeamId),
      awayUsed: usedTeamIds.has(m.awayTeamId),
    }));
  }

  // ─── Deadline: jornada en vigor ─────────────────────────────────────────

  /**
   * Matchday en vigor dentro del rango de la edición: la abierta (SCHEDULED u ONGOING) que viene
   * antes en calendario de competición (primer pitido), no necesariamente la de número mínimo.
   */
  async getEditionDeadline(editionId: string) {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        championship: {
          include: { footballLeague: { select: { currentSeason: true } } },
        },
      },
    });

    if (!edition) throw new NotFoundException('Edición no encontrada');

    const matchday = await findNextOpenMatchdayByCalendar(this.prisma, {
      leagueId: edition.championship.footballLeagueId,
      season: edition.championship.footballLeague.currentSeason,
      number: {
        gte: edition.startMatchday,
        ...(edition.endMatchday !== null ? { lte: edition.endMatchday } : {}),
      },
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

    return {
      matchdayNumber: matchday?.number ?? null,
      matchdayStatus: matchday?.status ?? null,
      firstKickoff,
    };
  }

  // ─── Get Available Teams for Matchday ────────────────────────────────────

  async getAvailableTeams(userId: string, editionId: string, matchdayNumber: number) {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        championship: {
          include: { footballLeague: { select: { id: true, currentSeason: true, totalMatchdaysPerSeason: true } } },
        },
      },
    });

    if (!edition) throw new NotFoundException('Edición no encontrada');

    const participant = await this.prisma.participant.findUnique({
      where: { userId_editionId: { userId, editionId } },
    });
    if (!participant) throw new ForbiddenException('No eres participante de esta edición');

    const { pickResetAtMidseason } = edition.championship;
    const total = edition.championship.footballLeague.totalMatchdaysPerSeason;
    const half: PickHalf =
      pickResetAtMidseason && matchdayNumber > Math.floor(total / 2) ? PickHalf.SECOND : PickHalf.FIRST;

    const allTeams = await this.prisma.footballTeam.findMany({
      where: { leagueId: edition.championship.footballLeagueId },
      select: { id: true, name: true, logoUrl: true },
    });

    const usedUsages = await this.prisma.teamUsage.findMany({
      where: { participantId: participant.id, editionId, half },
      select: { teamId: true },
    });

    const usedTeamIds = new Set(usedUsages.map((u) => u.teamId));
    return allTeams.map((t) => ({ ...t, used: usedTeamIds.has(t.id) }));
  }
}

