import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { MatchdayStatus, ParticipantStatus, PickStatus } from '@prisma/client';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Every 5 minutes: send pick reminders 2h before firstKickoff.
   * EC-33: Only to participants who haven't picked yet.
   * EC-34: Only to ACTIVE participants.
   */
  @Cron('*/5 * * * *')
  async sendPickReminders() {
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + TWO_HOURS_MS);

    // Find matchdays kicking off in the next 2 hours (within the 5-min window)
    const upcomingMatchdays = await this.prisma.matchday.findMany({
      where: {
        status: MatchdayStatus.SCHEDULED,
        firstKickoff: {
          gt: now,
          lte: twoHoursFromNow,
        },
      },
    });

    for (const matchday of upcomingMatchdays) {
      // Find active editions using this league
      const activeEditions = await this.prisma.edition.findMany({
        where: {
          status: 'ACTIVE',
          championship: { footballLeagueId: matchday.leagueId },
          startMatchday: { lte: matchday.number },
          OR: [{ endMatchday: null }, { endMatchday: { gte: matchday.number } }],
        },
        include: {
          participants: {
            where: { status: ParticipantStatus.ACTIVE },
            include: {
              picks: { where: { matchdayId: matchday.id } },
              user: { select: { id: true, alias: true } },
            },
          },
        },
      });

      for (const edition of activeEditions) {
        for (const participant of edition.participants) {
          // EC-33: Skip if already picked
          if (participant.picks.length > 0) continue;

          const minutesLeft = Math.round(
            (matchday.firstKickoff!.getTime() - now.getTime()) / 60000,
          );

          await this.notifications.send(
            participant.userId,
            'PICK_REMINDER',
            { editionId: edition.id, matchdayNumber: matchday.number, minutesLeft },
            {
              subject: `⏰ Tienes ${minutesLeft} minutos para hacer tu pick — Pick & Survive`,
              html: `
                <h2>Recuerda hacer tu pick, @${participant.user.alias}!</h2>
                <p>La jornada ${matchday.number} comienza en aproximadamente ${minutesLeft} minutos.</p>
                <p>Si no haces tu pick antes del inicio, serás penalizado.</p>
                <p><a href="${this.prisma['config']?.get?.('APP_URL') ?? 'http://localhost:3000'}/edition/${edition.id}">Ir a hacer mi pick →</a></p>
              `,
            },
          );

          this.logger.log(
            `Reminder sent to ${participant.user.alias} for matchday ${matchday.number}`,
          );
        }
      }
    }
  }
}
