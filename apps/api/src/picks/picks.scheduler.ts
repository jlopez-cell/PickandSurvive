import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PickProcessingService } from './pick-processing.service';
import { MatchdayStatus, PickHalf } from '@prisma/client';

@Injectable()
export class PicksScheduler {
  private readonly logger = new Logger(PicksScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pickProcessing: PickProcessingService,
  ) {}

  /**
   * Every minute: find matchdays whose firstKickoff has passed but are still SCHEDULED.
   * → trigger no-pick deadline processing.
   */
  @Cron('* * * * *')
  async processDeadlines() {
    const now = new Date();

    const overdueMatchdays = await this.prisma.matchday.findMany({
      where: {
        status: MatchdayStatus.SCHEDULED,
        firstKickoff: { lte: now },
      },
    });

    for (const matchday of overdueMatchdays) {
      this.logger.log(`Processing deadline for matchday ${matchday.id} (round ${matchday.number})`);
      await this.pickProcessing.processNoPickDeadline(matchday.id);

      // Mark matchday as ONGOING
      await this.prisma.matchday.update({
        where: { id: matchday.id },
        data: { status: MatchdayStatus.ONGOING },
      });
    }
  }

  /**
   * Midseason reset: when a matchday in the second half begins,
   * the FIRST-half TeamUsages no longer block picks in the SECOND half.
   * (This is handled at pick-time by resolvePickHalf, no DB action needed.)
   */
}
