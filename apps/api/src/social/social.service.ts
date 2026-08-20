import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChampionshipMode, PickHalf, PickStatus, Prisma } from '@prisma/client';

@Injectable()
export class SocialService {
  constructor(private readonly prisma: PrismaService) {}

  async applyBlock(
    userId: string,
    editionId: string,
    targetParticipantId: string,
    matchdayNumber: number,
  ) {
    const blocker = await this.prisma.participant.findUnique({
      where: { userId_editionId: { userId, editionId } },
    });
    if (!blocker) throw new ForbiddenException('No eres participante de esta edición');
    if (blocker.blocksRemaining <= 0) throw new ForbiddenException('No tienes bloqueos disponibles');

    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: { championship: { include: { footballLeague: { select: { currentSeason: true } } } } },
    });
    if (!edition) throw new NotFoundException('Edición no encontrada');

    const matchday = await this.prisma.matchday.findFirst({
      where: {
        leagueId: edition.championship.footballLeagueId,
        season: edition.championship.footballLeague.currentSeason,
        number: matchdayNumber,
      },
    });
    if (!matchday) throw new NotFoundException('Jornada no encontrada');

    const now = new Date();
    if (matchday.firstKickoff && matchday.firstKickoff <= now) {
      throw new BadRequestException('El kickoff de la jornada ya ha pasado');
    }

    const existing = await this.prisma.block.findUnique({
      where: {
        editionId_blockedParticipantId_matchdayNumber: {
          editionId,
          blockedParticipantId: targetParticipantId,
          matchdayNumber,
        },
      },
    });
    if (existing) throw new ConflictException('Ya existe un bloqueo para este jugador en esta jornada');

    await this.prisma.$transaction([
      this.prisma.participant.update({
        where: { id: blocker.id },
        data: { blocksRemaining: { decrement: 1 } },
      }),
      this.prisma.block.create({
        data: {
          editionId,
          blockerParticipantId: blocker.id,
          blockedParticipantId: targetParticipantId,
          matchdayNumber,
        },
      }),
    ]);

    return { message: 'Bloqueo aplicado correctamente.' };
  }

  async applyVeto(
    userId: string,
    editionId: string,
    targetParticipantId: string,
    teamId: string,
    matchdayNumber: number,
  ) {
    const vetoer = await this.prisma.participant.findUnique({
      where: { userId_editionId: { userId, editionId } },
    });
    if (!vetoer) throw new ForbiddenException('No eres participante de esta edición');
    if (vetoer.vetosRemaining <= 0) throw new ForbiddenException('No tienes vetos disponibles');

    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        championship: {
          include: {
            footballLeague: {
              select: { currentSeason: true, totalMatchdaysPerSeason: true },
            },
          },
        },
      },
    });
    if (!edition) throw new NotFoundException('Edición no encontrada');

    const matchday = await this.prisma.matchday.findFirst({
      where: {
        leagueId: edition.championship.footballLeagueId,
        season: edition.championship.footballLeague.currentSeason,
        number: matchdayNumber,
      },
    });
    if (!matchday) throw new NotFoundException('Jornada no encontrada');

    const now = new Date();
    const deadline = matchday.firstKickoff
      ? new Date(matchday.firstKickoff.getTime() - 48 * 60 * 60 * 1000)
      : null;
    if (!deadline || deadline <= now) {
      throw new BadRequestException(
        'El tiempo para aplicar vetos ya ha cerrado (debe ser más de 48h antes del primer kickoff)',
      );
    }

    const existingVeto = await this.prisma.veto.findUnique({
      where: {
        editionId_vetoedParticipantId_teamId_matchdayNumber: {
          editionId,
          vetoedParticipantId: targetParticipantId,
          teamId,
          matchdayNumber,
        },
      },
    });
    if (existingVeto) throw new ConflictException('Ya existe un veto para este equipo en esta jornada');

    await this.prisma.$transaction(async (tx) => {
      await tx.participant.update({
        where: { id: vetoer.id },
        data: { vetosRemaining: { decrement: 1 } },
      });

      await tx.veto.create({
        data: {
          editionId,
          vetoerParticipantId: vetoer.id,
          vetoedParticipantId: targetParticipantId,
          teamId,
          matchdayNumber,
        },
      });

      const existingPick = await tx.pick.findFirst({
        where: {
          participantId: targetParticipantId,
          matchdayId: matchday.id,
          teamId,
        },
      });

      if (existingPick) {
        const { pickResetAtMidseason } = edition.championship;
        const total = edition.championship.footballLeague.totalMatchdaysPerSeason;
        const half: PickHalf =
          pickResetAtMidseason && matchdayNumber > Math.floor(total / 2)
            ? PickHalf.SECOND
            : PickHalf.FIRST;

        await tx.pick.delete({ where: { id: existingPick.id } });

        await tx.teamUsage.deleteMany({
          where: { participantId: targetParticipantId, teamId, editionId, half },
        });

        const [team, targetParticipant] = await Promise.all([
          tx.footballTeam.findUnique({ where: { id: teamId }, select: { name: true } }),
          tx.participant.findUnique({ where: { id: targetParticipantId }, select: { userId: true } }),
        ]);

        await tx.notification.create({
          data: {
            userId: targetParticipant!.userId,
            type: 'PICK_REMINDER',
            payload: { reason: 'VETO', teamName: team?.name, matchdayNumber },
          },
        });
      }
    });

    return { message: 'Veto aplicado correctamente.' };
  }

  async applyChallenge(
    userId: string,
    editionId: string,
    targetParticipantId: string,
    matchdayNumber: number,
  ) {
    const challenger = await this.prisma.participant.findUnique({
      where: { userId_editionId: { userId, editionId } },
    });
    if (!challenger) throw new ForbiddenException('No eres participante de esta edición');
    if (challenger.challengesRemaining <= 0) throw new ForbiddenException('No tienes retos disponibles');

    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        championship: {
          include: { footballLeague: { select: { currentSeason: true } } },
        },
      },
    });
    if (!edition) throw new NotFoundException('Edición no encontrada');

    const matchday = await this.prisma.matchday.findFirst({
      where: {
        leagueId: edition.championship.footballLeagueId,
        season: edition.championship.footballLeague.currentSeason,
        number: matchdayNumber,
      },
    });
    if (!matchday) throw new NotFoundException('Jornada no encontrada');

    const now = new Date();
    const deadline = matchday.firstKickoff
      ? new Date(matchday.firstKickoff.getTime() - 48 * 60 * 60 * 1000)
      : null;
    if (!deadline || deadline <= now) {
      throw new BadRequestException(
        'El tiempo para aplicar retos ya ha cerrado (debe ser más de 48h antes del primer kickoff)',
      );
    }

    const existingChallenge = await this.prisma.challenge.findUnique({
      where: {
        editionId_challengerParticipantId_matchdayNumber: {
          editionId,
          challengerParticipantId: challenger.id,
          matchdayNumber,
        },
      },
    });
    if (existingChallenge) throw new ConflictException('Ya has retado a alguien en esta jornada');

    await this.prisma.$transaction(async (tx) => {
      await tx.participant.update({
        where: { id: challenger.id },
        data: { challengesRemaining: { decrement: 1 } },
      });

      await tx.challenge.create({
        data: {
          editionId,
          challengerParticipantId: challenger.id,
          challengedParticipantId: targetParticipantId,
          matchdayNumber,
          status: 'ACTIVE',
        },
      });

      const targetParticipant = await tx.participant.findUnique({
        where: { id: targetParticipantId },
        select: { userId: true },
      });

      await tx.notification.create({
        data: {
          userId: targetParticipant!.userId,
          type: 'PICK_REMINDER',
          payload: { reason: 'CHALLENGE', matchdayNumber },
        },
      });
    });

    return { message: 'Reto aplicado correctamente.' };
  }

  async resolveChallenge(challengeId: string, tx: Prisma.TransactionClient) {
    const challenge = await tx.challenge.findUnique({
      where: { id: challengeId },
      include: {
        edition: { include: { championship: { select: { mode: true } } } },
      },
    });
    if (!challenge) return;

    const mode = challenge.edition.championship.mode;

    const [challengerPick, challengedPick] = await Promise.all([
      tx.pick.findFirst({
        where: {
          participantId: challenge.challengerParticipantId,
          matchday: { number: challenge.matchdayNumber },
        },
      }),
      tx.pick.findFirst({
        where: {
          participantId: challenge.challengedParticipantId,
          matchday: { number: challenge.matchdayNumber },
        },
      }),
    ]);

    const calcScore = (pick: typeof challengerPick): number => {
      if (!pick) return 0;
      if (mode === ChampionshipMode.LEAGUE) {
        return (
          (pick.pointsAwarded ?? 0) +
          pick.streakBonusPoints +
          (pick.underdogBonus ? 1 : 0)
        );
      }
      if (pick.status === PickStatus.SURVIVED) return 3;
      if (pick.status === PickStatus.DRAW_ELIMINATED) return 1;
      return 0;
    };

    const challengerScore = calcScore(challengerPick);
    const challengedScore = calcScore(challengedPick);

    const now = new Date();

    if (challengerScore > challengedScore) {
      await tx.participant.update({
        where: { id: challenge.challengedParticipantId },
        data: { totalPoints: { decrement: 1 } },
      });
      await tx.challenge.update({
        where: { id: challengeId },
        data: { status: 'RESOLVED', result: 'CHALLENGER_WINS', resolvedAt: now },
      });
    } else if (challengedScore > challengerScore) {
      await tx.participant.update({
        where: { id: challenge.challengerParticipantId },
        data: { totalPoints: { decrement: 1 } },
      });
      await tx.challenge.update({
        where: { id: challengeId },
        data: { status: 'RESOLVED', result: 'CHALLENGED_WINS', resolvedAt: now },
      });
    } else {
      await tx.participant.update({
        where: { id: challenge.challengerParticipantId },
        data: { challengesRemaining: { increment: 1 } },
      });
      await tx.challenge.update({
        where: { id: challengeId },
        data: { status: 'RESOLVED', result: 'TIE', resolvedAt: now },
      });
    }
  }
}
