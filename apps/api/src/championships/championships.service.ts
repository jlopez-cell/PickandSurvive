import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';
import { CreateChampionshipDto } from './dto/create-championship.dto';
import { CreateEditionDto } from './dto/create-edition.dto';
import { InviteEmailDto } from './dto/invite-email.dto';
import { syncApprovedMembersToEditionTx as syncMembersToEditionTx } from './edition-member-sync';
import {
  ChampionshipMode,
  EditionStatus,
  JoinRequestSource,
  JoinRequestStatus,
  MatchdayStatus,
  Prisma,
} from '@prisma/client';
import { findNextOpenMatchdayByCalendar } from '../matchdays/find-next-open-matchday-by-calendar';

@Injectable()
export class ChampionshipsService {
  private resend: Resend;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  // ─── Ligas ─────────────────────────────────────────────────────────────────

  async getLeagues() {
    return this.prisma.footballLeague.findMany({
      select: { id: true, name: true, country: true, apiFootballId: true },
      orderBy: { name: 'asc' },
    });
  }

  // ─── Campeonatos ───────────────────────────────────────────────────────────

  async createChampionship(userId: string, dto: CreateChampionshipDto) {
    let footballLeagueId: string;

    if (dto.mode === ChampionshipMode.WORLD_CUP) {
      const existing = await this.prisma.footballLeague.findUnique({
        where: { apiFootballId: 2000 },
      });
      const wcLeague = existing ?? (await this.prisma.footballLeague.create({
        data: {
          name: 'FIFA World Cup',
          country: 'World',
          apiFootballId: 2000,
          totalMatchdaysPerSeason: 64,
          currentSeason: 2026,
        },
      }));
      footballLeagueId = wcLeague.id;
    } else {
      if (!dto.footballLeagueId) throw new BadRequestException('La liga es obligatoria');
      const league = await this.prisma.footballLeague.findUnique({
        where: { id: dto.footballLeagueId },
      });
      if (!league) throw new NotFoundException('Liga no encontrada');
      footballLeagueId = league.id;
    }

    return this.prisma.championship.create({
      data: {
        name: dto.name,
        footballLeagueId,
        mode: dto.mode,
        pickResetAtMidseason: dto.pickResetAtMidseason ?? false,
        streakBonusEnabled: dto.streakBonusEnabled ?? false,
        wildcardCount: dto.wildcardCount ?? 0,
        ghostModeEnabled: dto.ghostModeEnabled ?? false,
        socialPressureEnabled: dto.socialPressureEnabled ?? false,
        doubleOrNothingEnabled: dto.doubleOrNothingEnabled ?? false,
        underdogBonusEnabled: dto.underdogBonusEnabled ?? false,
        creatorId: userId,
        adminId: userId,
      },
    });
  }

  async getMyChampionships(userId: string) {
    return this.prisma.championship.findMany({
      where: {
        OR: [
          { adminId: userId },
          {
            editions: {
              some: {
                participants: {
                  some: { userId },
                },
              },
            },
          },
        ],
      },
      include: {
        footballLeague: { select: { id: true, name: true, country: true } },
        editions: {
          where: { status: { in: ['ACTIVE', 'OPEN'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, startMatchday: true },
        },
        _count: { select: { joinRequests: { where: { status: JoinRequestStatus.PENDING } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getChampionshipById(userId: string, championshipId: string) {
    const championship = await this.prisma.championship.findUnique({
      where: { id: championshipId },
      include: {
        footballLeague: true,
        editions: { orderBy: { createdAt: 'desc' } },
        admin: { select: { id: true, alias: true } },
      },
    });

    if (!championship) throw new NotFoundException('Campeonato no encontrado');

    // Check if user is admin or participant
    const isAdmin = championship.adminId === userId;
    const isParticipant = await this.prisma.participant.findFirst({
      where: { userId, edition: { championshipId } },
    });

    if (!isAdmin && !isParticipant) {
      throw new ForbiddenException('No tienes acceso a este campeonato');
    }

    return {
      ...championship,
      leagueCurrentMatchday: await this.getLeagueCurrentMatchday(championship.footballLeagueId),
    };
  }

  // ─── Ediciones ────────────────────────────────────────────────────────────

  async createEdition(userId: string, championshipId: string, dto: CreateEditionDto) {
    const championship = await this.prisma.championship.findUnique({
      where: { id: championshipId },
      include: {
        footballLeague: {
          select: {
            currentSeason: true,
          },
        },
      },
    });

    if (!championship) throw new NotFoundException('Campeonato no encontrado');
    if (championship.adminId !== userId) throw new ForbiddenException('Solo el admin puede crear ediciones');

    // LEAGUE mode requires endMatchday
    if (championship.mode === ChampionshipMode.LEAGUE && !dto.endMatchday) {
      throw new BadRequestException('El modo LIGA requiere jornada de fin (endMatchday)');
    }

    // Validate startMatchday < endMatchday if both provided
    if (dto.endMatchday && dto.startMatchday >= dto.endMatchday) {
      throw new BadRequestException('La jornada de inicio debe ser anterior a la jornada de fin');
    }

    const currentLeagueMatchday = await this.getLeagueCurrentMatchday(championship.footballLeagueId);

    if (dto.startMatchday < currentLeagueMatchday) {
      throw new BadRequestException(
        `La jornada de inicio no puede ser anterior a la jornada actual de la liga (J${currentLeagueMatchday})`,
      );
    }

    // Cannot have more than 1 ACTIVE edition at the same time
    const activeEdition = await this.prisma.edition.findFirst({
      where: { championshipId, status: EditionStatus.ACTIVE },
    });
    if (activeEdition) {
      throw new ConflictException('Ya existe una edición activa para este campeonato');
    }

    return this.prisma.edition.create({
      data: {
        championshipId,
        startMatchday: dto.startMatchday,
        endMatchday: dto.endMatchday ?? null,
        potAmountCents: dto.potAmountCents ?? 0,
        status: EditionStatus.DRAFT,
      },
    });
  }

  async publishEdition(userId: string, championshipId: string, editionId: string) {
    const edition = await this.getEditionOrThrow(championshipId, editionId);

    if (edition.championship.adminId !== userId) {
      throw new ForbiddenException('Solo el admin puede publicar ediciones');
    }

    if (edition.status !== EditionStatus.DRAFT) {
      throw new ConflictException(`La edición no está en estado BORRADOR (estado actual: ${edition.status})`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.edition.update({
        where: { id: editionId },
        data: { status: EditionStatus.OPEN },
      });
      await syncMembersToEditionTx(tx, editionId);
    });

    return this.prisma.edition.findUnique({ where: { id: editionId } });
  }

  async activateEdition(userId: string, championshipId: string, editionId: string) {
    const edition = await this.getEditionOrThrow(championshipId, editionId);

    if (edition.championship.adminId !== userId) {
      throw new ForbiddenException('Solo el admin puede activar ediciones');
    }

    if (edition.status !== EditionStatus.OPEN && edition.status !== EditionStatus.DRAFT) {
      throw new ConflictException(`La edición debe estar en BORRADOR o ABIERTA para activarse (estado actual: ${edition.status})`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.edition.update({
        where: { id: editionId },
        data: { status: EditionStatus.ACTIVE },
      });
      await syncMembersToEditionTx(tx, editionId);
      if (edition.championship.wildcardCount > 0) {
        await tx.participant.updateMany({
          where: { editionId },
          data: { wildcardsRemaining: edition.championship.wildcardCount },
        });
      }
    });

    return { message: 'Edición activada correctamente.' };
  }

  /**
   * Vuelve a matricular en la edición a miembros APPROVED, admin y participantes de la última edición FINISHED.
   * Solo admin; ediciones DRAFT, OPEN o ACTIVE. Idempotente.
   */
  async resyncEditionMembers(userId: string, championshipId: string, editionId: string) {
    const edition = await this.getEditionOrThrow(championshipId, editionId);

    if (edition.championship.adminId !== userId) {
      throw new ForbiddenException('Solo el admin puede sincronizar participantes');
    }

    if (
      edition.status !== EditionStatus.DRAFT &&
      edition.status !== EditionStatus.OPEN &&
      edition.status !== EditionStatus.ACTIVE
    ) {
      throw new ConflictException(
        `Solo se pueden sincronizar ediciones en borrador, abiertas o activas (estado actual: ${edition.status})`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await syncMembersToEditionTx(tx, editionId);
    });

    return {
      message:
        'Participantes sincronizados con los miembros aprobados y la última edición finalizada.',
      editionId,
    };
  }

  // ─── Invitaciones — Enlace ─────────────────────────────────────────────────

  async generateInviteLink(championshipId: string) {
    const link = await this.prisma.invitationLink.create({
      data: { championshipId },
    });

    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
    return {
      token: link.token,
      url: `${appUrl}/join/${link.token}`,
    };
  }

  // ─── Invitaciones — Email ──────────────────────────────────────────────────

  async sendInviteEmail(championshipId: string, dto: InviteEmailDto) {
    const championship = await this.prisma.championship.findUnique({
      where: { id: championshipId },
      select: { name: true },
    });
    if (!championship) throw new NotFoundException('Campeonato no encontrado');

    // Generate (or reuse) an invite link
    let link = await this.prisma.invitationLink.findFirst({
      where: { championshipId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!link) {
      link = await this.prisma.invitationLink.create({
        data: { championshipId },
      });
    }

    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
    const inviteUrl = `${appUrl}/join/${link.token}`;

    const emailProvider = (this.configService.get<string>('EMAIL_PROVIDER', 'resend') ?? 'resend').toLowerCase();

    const subject = `Invitación a "${championship.name}" — Pick & Survive`;
    const html = `
      <h2>Te han invitado a unirte a "${championship.name}"</h2>
      <p>Haz clic en el siguiente enlace para solicitar unirte al campeonato:</p>
      <p><a href="${inviteUrl}">${inviteUrl}</a></p>
      <p>Si no esperabas esta invitación, puedes ignorar este email.</p>
    `;

    const sendViaResend = async () => {
      const sendRes = await this.resend.emails.send({
        from: 'Pick & Survive <noreply@pickandsurvive.com>',
        to: dto.email,
        subject,
        html,
      });

      const resendAny = sendRes as any;
      if (resendAny?.error) {
        const msg =
          typeof resendAny.error?.message === 'string'
            ? resendAny.error.message
            : 'Error al enviar el email';
        throw new BadRequestException(msg);
      }

      const resendId = resendAny?.id ?? resendAny?.messageId ?? resendAny?.data?.id ?? null;
      const resendStatus = resendAny?.status ?? resendAny?.data?.status ?? null;
      return {
        message: `Invitación enviada a ${dto.email}`,
        resendId,
        resendStatus,
        resendRaw: resendAny ?? null,
      };
    };

    const sendViaGmail = async () => {
      const gmailUser = this.configService.get<string>('GMAIL_SMTP_USER');
      const gmailPass = this.configService.get<string>('GMAIL_SMTP_PASS');
      if (!gmailUser || !gmailPass) {
        throw new BadRequestException('Faltan credenciales SMTP de Gmail');
      }

      const host = this.configService.get<string>('GMAIL_SMTP_HOST', 'smtp.gmail.com');
      const portRaw = this.configService.get<string>('GMAIL_SMTP_PORT', '465');
      const port = Number(portRaw);
      const secureRaw = this.configService.get<string>('GMAIL_SMTP_SECURE', String(port === 465));
      const secure = secureRaw === 'true' || port === 465;

      const fromEmail = this.configService.get<string>('GMAIL_FROM_EMAIL', gmailUser);
      const fromName = this.configService.get<string>('GMAIL_FROM_NAME', 'Pick & Survive');

      const transport = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user: gmailUser, pass: gmailPass },
      });

      await transport.sendMail({
        from: `${fromName} <${fromEmail}>`,
        to: dto.email,
        subject,
        html,
      });

      return {
        message: `Invitación enviada a ${dto.email} (Gmail)`,
      };
    };

    if (emailProvider === 'gmail') {
      return sendViaGmail();
    }

    if (emailProvider === 'resend') {
      return sendViaResend();
    }

    // fallback
    try {
      return await sendViaResend();
    } catch (err) {
      console.warn('Resend falló, pasando a Gmail:', (err as Error)?.message);
      try {
        return await sendViaGmail();
      } catch (gmailErr) {
        const msg = (gmailErr as any)?.message ?? 'Error al enviar el email (fallback Gmail)';
        throw new BadRequestException(msg);
      }
    }
  }

  // ─── Unirse con token ─────────────────────────────────────────────────────

  async joinByToken(userId: string, token: string) {
    const link = await this.prisma.invitationLink.findUnique({
      where: { token },
      include: { championship: { select: { id: true, name: true } } },
    });

    if (!link) {
      throw new NotFoundException('Enlace de invitación inválido o expirado');
    }

    if (link.isActive === false) {
      throw new ForbiddenException('Enlace de invitación desactivado');
    }

    const championshipId = link.championshipId;

    // Check there's a joinable edition (OPEN or ACTIVE)
    const joinableEdition = await this.prisma.edition.findFirst({
      where: { championshipId, status: { in: [EditionStatus.OPEN, EditionStatus.ACTIVE] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!joinableEdition) {
      throw new ForbiddenException('No hay ninguna edición abierta o activa para este campeonato en este momento');
    }

    // Check if user already has a pending/approved request
    const existing = await this.prisma.joinRequest.findUnique({
      where: { championshipId_userId: { championshipId, userId } },
    });

    if (existing) {
      if (existing.status === JoinRequestStatus.PENDING) {
        return { message: 'Ya tienes una solicitud pendiente para este campeonato' };
      }
      if (existing.status === JoinRequestStatus.APPROVED) {
        return { message: 'Ya eres participante de este campeonato' };
      }
      // If previously rejected, update to pending
      await this.prisma.joinRequest.update({
        where: { id: existing.id },
        data: { status: JoinRequestStatus.PENDING, source: JoinRequestSource.LINK },
      });
      return { message: 'Solicitud reenviada. El admin del campeonato deberá aprobarla.' };
    }

    await this.prisma.joinRequest.create({
      data: {
        championshipId,
        userId,
        source: JoinRequestSource.LINK,
        status: JoinRequestStatus.PENDING,
      },
    });

    // Notify admin
    await this.notifyAdminNewRequest(championshipId, userId);

    return { message: 'Solicitud enviada. El admin del campeonato deberá aprobarla.' };
  }

  // ─── Solicitudes de Unión ─────────────────────────────────────────────────

  async getJoinRequests(championshipId: string, status?: JoinRequestStatus) {
    return this.prisma.joinRequest.findMany({
      where: {
        championshipId,
        ...(status ? { status } : {}),
      },
      include: {
        user: { select: { id: true, alias: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approveJoinRequest(userId: string, championshipId: string, requestId: string) {
    const request = await this.getJoinRequestOrThrow(requestId, championshipId);

    if (request.status !== JoinRequestStatus.PENDING) {
      throw new ConflictException(`La solicitud ya fue procesada (estado: ${request.status})`);
    }

    const joinableEditions = await this.prisma.edition.findMany({
      where: { championshipId, status: { in: [EditionStatus.OPEN, EditionStatus.ACTIVE] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (joinableEditions.length === 0) {
      throw new ForbiddenException('No hay edición abierta o activa. No se puede aprobar la solicitud.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.joinRequest.update({
        where: { id: requestId },
        data: { status: JoinRequestStatus.APPROVED },
      });
      for (const ed of joinableEditions) {
        await syncMembersToEditionTx(tx, ed.id);
      }
    });

    const primaryEditionId = joinableEditions[0].id;

    await this.prisma.notification.create({
      data: {
        userId: request.userId,
        type: 'JOIN_APPROVED',
        payload: { championshipId, editionId: primaryEditionId },
      },
    });

    return { message: 'Solicitud aprobada. El usuario ha sido añadido como participante.' };
  }

  async rejectJoinRequest(userId: string, championshipId: string, requestId: string) {
    const request = await this.getJoinRequestOrThrow(requestId, championshipId);

    if (request.status !== JoinRequestStatus.PENDING) {
      throw new ConflictException(`La solicitud ya fue procesada (estado: ${request.status})`);
    }

    await this.prisma.joinRequest.update({
      where: { id: requestId },
      data: { status: JoinRequestStatus.REJECTED },
    });

    // Notify user
    await this.prisma.notification.create({
      data: {
        userId: request.userId,
        type: 'JOIN_REJECTED',
        payload: { championshipId },
      },
    });

    return { message: 'Solicitud rechazada.' };
  }

  // ─── Abandono y Transfer de Admin ────────────────────────────────────────

  async leaveChampionship(userId: string, championshipId: string) {
    const championship = await this.prisma.championship.findUnique({
      where: { id: championshipId },
      select: { adminId: true, creatorId: true },
    });

    if (!championship) throw new NotFoundException('Campeonato no encontrado');

    // Check the user is actually a member (approved join request)
    const joinRequest = await this.prisma.joinRequest.findUnique({
      where: { championshipId_userId: { championshipId, userId } },
    });

    const isAdmin = championship.adminId === userId;

    if (!joinRequest && !isAdmin) {
      throw new ForbiddenException('No eres miembro de este campeonato');
    }

    if (isAdmin) {
      // Transfer admin to the oldest approved member (excluding self)
      const oldestMember = await this.prisma.joinRequest.findFirst({
        where: {
          championshipId,
          status: JoinRequestStatus.APPROVED,
          userId: { not: userId },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (!oldestMember) {
        // No other members — admin cannot leave (or could delete, but that's a separate concern)
        throw new ForbiddenException(
          'Eres el único miembro. No puedes abandonar el campeonato. Elimínalo si quieres cerrarlo.',
        );
      }

      await this.prisma.championship.update({
        where: { id: championshipId },
        data: { adminId: oldestMember.userId },
      });
    }

    // Mark join request as rejected to remove membership
    if (joinRequest) {
      await this.prisma.joinRequest.update({
        where: { id: joinRequest.id },
        data: { status: JoinRequestStatus.REJECTED },
      });
    }

    return { message: 'Has abandonado el campeonato correctamente.' };
  }

  // ─── Eliminación (admin) ────────────────────────────────────────────────

  async deleteChampionship(userId: string, championshipId: string) {
    const championship = await this.prisma.championship.findUnique({
      where: { id: championshipId },
      select: { adminId: true },
    });

    if (!championship) throw new NotFoundException('Campeonato no encontrado');
    if (championship.adminId !== userId) throw new ForbiddenException('Solo el admin puede eliminar el campeonato');

    const editionIds = await this.prisma.edition.findMany({
      where: { championshipId },
      select: { id: true },
    });

    const editionIdList = editionIds.map((e) => e.id);

    await this.prisma.$transaction(async (tx) => {
      if (editionIdList.length > 0) {
        await tx.pick.deleteMany({
          where: {
            participant: {
              editionId: { in: editionIdList },
            },
          },
        });

        await tx.teamUsage.deleteMany({
          where: { editionId: { in: editionIdList } },
        });

        await tx.potLedger.deleteMany({
          where: { editionId: { in: editionIdList } },
        });

        await tx.participant.deleteMany({
          where: { editionId: { in: editionIdList } },
        });

        await tx.edition.deleteMany({
          where: { championshipId },
        });
      }

      await tx.joinRequest.deleteMany({
        where: { championshipId },
      });

      await tx.invitationLink.deleteMany({
        where: { championshipId },
      });

      await tx.championship.delete({
        where: { id: championshipId },
      });
    });

    return { message: 'Campeonato eliminado correctamente.' };
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  /**
   * @deprecated Usar `syncApprovedMembersToEditionTx` importado desde `./edition-member-sync`.
   * Se mantiene como delegado para `EditionsScheduler` y pruebas.
   */
  async syncApprovedMembersToEditionTx(tx: Prisma.TransactionClient, editionId: string): Promise<void> {
    return syncMembersToEditionTx(tx, editionId);
  }

  private async getEditionOrThrow(championshipId: string, editionId: string) {
    const edition = await this.prisma.edition.findFirst({
      where: { id: editionId, championshipId },
      include: { championship: { select: { adminId: true, wildcardCount: true } } },
    });
    if (!edition) throw new NotFoundException('Edición no encontrada');
    return edition;
  }

  private async getJoinRequestOrThrow(requestId: string, championshipId: string) {
    const request = await this.prisma.joinRequest.findFirst({
      where: { id: requestId, championshipId },
    });
    if (!request) throw new NotFoundException('Solicitud no encontrada');
    return request;
  }

  private async notifyAdminNewRequest(championshipId: string, requestingUserId: string) {
    const championship = await this.prisma.championship.findUnique({
      where: { id: championshipId },
      select: { adminId: true },
    });
    if (!championship) return;

    await this.prisma.notification.create({
      data: {
        userId: championship.adminId,
        type: 'NEW_JOIN_REQUEST',
        payload: { championshipId, requestingUserId },
      },
    });
  }

  /**
   * Jornada mínima permitida al crear una edición: temporada actual de la liga.
   * - Primero: entre jornadas abiertas (SCHEDULED u ONGOING), la que viene antes en **calendario**
   *   (primer pitido más temprano), no la de número mínimo — la API puede adelantar una jornada
   *   mayor antes que otra menor siga pendiente.
   * - Si no hay ninguna abierta: la primera con primer pitido futuro (por si el estado aún no está sincronizado).
   * - Si la temporada está toda cerrada: última jornada FINISHED.
   * - Fallback: 1.
   */
  private async getLeagueCurrentMatchday(leagueId: string): Promise<number> {
    const league = await this.prisma.footballLeague.findUnique({
      where: { id: leagueId },
      select: { currentSeason: true },
    });
    const season = league?.currentSeason;
    if (season == null) return 1;

    const inSeason = { leagueId, season } as const;
    const now = new Date();

    const nextOpen = await findNextOpenMatchdayByCalendar(this.prisma, inSeason);
    if (nextOpen?.number != null) {
      return nextOpen.number;
    }

    const nextByKickoff = await this.prisma.matchday.findFirst({
      where: { ...inSeason, firstKickoff: { gte: now } },
      orderBy: [{ firstKickoff: 'asc' }, { number: 'asc' }],
      select: { number: true },
    });
    if (nextByKickoff?.number != null) {
      return nextByKickoff.number;
    }

    const latestFinished = await this.prisma.matchday.findFirst({
      where: { ...inSeason, status: MatchdayStatus.FINISHED },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    return latestFinished?.number ?? 1;
  }
}
