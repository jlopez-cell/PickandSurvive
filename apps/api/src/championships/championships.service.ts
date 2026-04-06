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
import { ChampionshipMode, EditionStatus, JoinRequestSource, JoinRequestStatus, MatchdayStatus } from '@prisma/client';

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
    const league = await this.prisma.footballLeague.findUnique({
      where: { id: dto.footballLeagueId },
    });
    if (!league) throw new NotFoundException('Liga no encontrada');

    return this.prisma.championship.create({
      data: {
        name: dto.name,
        footballLeagueId: dto.footballLeagueId,
        mode: dto.mode,
        pickResetAtMidseason: dto.pickResetAtMidseason ?? false,
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

    return this.prisma.edition.update({
      where: { id: editionId },
      data: { status: EditionStatus.OPEN },
    });
  }

  async activateEdition(userId: string, championshipId: string, editionId: string) {
    const edition = await this.getEditionOrThrow(championshipId, editionId);

    if (edition.championship.adminId !== userId) {
      throw new ForbiddenException('Solo el admin puede activar ediciones');
    }

    if (edition.status !== EditionStatus.OPEN) {
      throw new ConflictException(`La edición debe estar ABIERTA para activarse (estado actual: ${edition.status})`);
    }

    // Auto-add admin as participant if not already
    const existing = await this.prisma.participant.findUnique({
      where: { userId_editionId: { userId, editionId } },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.edition.update({
        where: { id: editionId },
        data: { status: EditionStatus.ACTIVE },
      });

      if (!existing) {
        await tx.participant.create({ data: { userId, editionId } });

        // Ensure JoinRequest exists and is approved
        await tx.joinRequest.upsert({
          where: { championshipId_userId: { championshipId, userId } },
          update: { status: JoinRequestStatus.APPROVED },
          create: {
            championshipId,
            userId,
            source: JoinRequestSource.LINK,
            status: JoinRequestStatus.APPROVED,
          },
        });
      }
    });

    return { message: 'Edición activada correctamente.' };
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

    // Find a joinable edition (OPEN or ACTIVE) to add participant
    const joinableEdition = await this.prisma.edition.findFirst({
      where: { championshipId, status: { in: [EditionStatus.OPEN, EditionStatus.ACTIVE] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!joinableEdition) {
      throw new ForbiddenException('No hay edición abierta o activa. No se puede aprobar la solicitud.');
    }

    // Check if already a participant (defensive)
    const existingParticipant = await this.prisma.participant.findUnique({
      where: { userId_editionId: { userId: request.userId, editionId: joinableEdition.id } },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.joinRequest.update({
        where: { id: requestId },
        data: { status: JoinRequestStatus.APPROVED },
      });

      if (!existingParticipant) {
        await tx.participant.create({
          data: { userId: request.userId, editionId: joinableEdition.id },
        });

        // Register entry fee if applicable
        if (joinableEdition.potAmountCents > 0) {
          await tx.potLedger.create({
            data: {
              editionId: joinableEdition.id,
              userId: request.userId,
              type: 'ENTRY_FEE',
              amountCents: joinableEdition.potAmountCents,
              description: `Entrada de participante ${request.userId}`,
            },
          });
        }
      }
    });

    // Notify user
    await this.prisma.notification.create({
      data: {
        userId: request.userId,
        type: 'JOIN_APPROVED',
        payload: { championshipId, editionId: joinableEdition.id },
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

  private async getEditionOrThrow(championshipId: string, editionId: string) {
    const edition = await this.prisma.edition.findFirst({
      where: { id: editionId, championshipId },
      include: { championship: { select: { adminId: true } } },
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
   * Jornada "actual" robusta para validaciones de creación:
   * - Prioriza la próxima jornada por fecha (firstKickoff >= ahora).
   * - Si no hay fechas futuras, toma la primera SCHEDULED/ONGOING.
   * - Si todo terminó, toma la última FINISHED.
   * - Fallback final: 1.
   */
  private async getLeagueCurrentMatchday(leagueId: string): Promise<number> {
    const now = new Date();

    const nextByKickoff = await this.prisma.matchday.findFirst({
      where: { leagueId, firstKickoff: { gte: now } },
      orderBy: [{ firstKickoff: 'asc' }, { season: 'desc' }, { number: 'asc' }],
      select: { number: true },
    });
    if (nextByKickoff?.number != null) {
      return nextByKickoff.number;
    }

    const pendingByStatus = await this.prisma.matchday.findFirst({
      where: { leagueId, status: { in: [MatchdayStatus.SCHEDULED, MatchdayStatus.ONGOING] } },
      orderBy: [{ season: 'desc' }, { number: 'asc' }],
      select: { number: true },
    });
    if (pendingByStatus?.number != null) {
      return pendingByStatus.number;
    }

    const latestFinished = await this.prisma.matchday.findFirst({
      where: { leagueId, status: MatchdayStatus.FINISHED },
      orderBy: [{ season: 'desc' }, { number: 'desc' }],
      select: { number: true },
    });
    return latestFinished?.number ?? 1;
  }
}
