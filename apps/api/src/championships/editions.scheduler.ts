import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EditionStatus, JoinRequestStatus } from '@prisma/client';

@Injectable()
export class EditionsScheduler {
  private readonly logger = new Logger(EditionsScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Hourly cron: activate or cancel OPEN editions whose startMatchday has arrived.
   * - ≥2 approved participants → ACTIVE, auto-reject PENDING requests
   * - <2 approved participants → CANCELLED
   */
  @Cron(CronExpression.EVERY_HOUR)
  async activateOrCancelEditions() {
    this.logger.log('Running edition activation cron...');

    const now = new Date();

    // Find all OPEN editions whose start matchday has already kicked off
    const openEditions = await this.prisma.edition.findMany({
      where: { status: EditionStatus.OPEN },
      include: {
        championship: {
          select: {
            id: true,
            footballLeagueId: true,
            adminId: true,
          },
        },
        participants: {
          select: { id: true },
        },
      },
    });

    for (const edition of openEditions) {
      try {
        // Find the matchday for this league + season + matchday number
        const league = await this.prisma.footballLeague.findUnique({
          where: { id: edition.championship.footballLeagueId },
          select: { currentSeason: true },
        });

        if (!league) continue;

        const matchday = await this.prisma.matchday.findUnique({
          where: {
            leagueId_season_number: {
              leagueId: edition.championship.footballLeagueId,
              season: league.currentSeason,
              number: edition.startMatchday,
            },
          },
          select: { firstKickoff: true },
        });

        // Start matchday hasn't been loaded from API yet, or hasn't started
        if (!matchday?.firstKickoff || matchday.firstKickoff > now) continue;

        // Count approved participants
        const approvedCount = await this.prisma.joinRequest.count({
          where: {
            championshipId: edition.championshipId,
            status: JoinRequestStatus.APPROVED,
          },
        });

        if (approvedCount >= 2) {
          await this.prisma.$transaction([
            // Activate edition
            this.prisma.edition.update({
              where: { id: edition.id },
              data: { status: EditionStatus.ACTIVE },
            }),
            // Auto-reject pending requests
            this.prisma.joinRequest.updateMany({
              where: {
                championshipId: edition.championshipId,
                status: JoinRequestStatus.PENDING,
              },
              data: { status: JoinRequestStatus.REJECTED },
            }),
          ]);

          this.logger.log(
            `Edition ${edition.id} → ACTIVE (${approvedCount} participants)`,
          );
        } else {
          await this.prisma.edition.update({
            where: { id: edition.id },
            data: { status: EditionStatus.CANCELLED },
          });

          this.logger.log(
            `Edition ${edition.id} → CANCELLED (only ${approvedCount} participants, min 2 required)`,
          );
        }
      } catch (err) {
        this.logger.error(`Error processing edition ${edition.id}: ${(err as Error).message}`);
      }
    }
  }
}
