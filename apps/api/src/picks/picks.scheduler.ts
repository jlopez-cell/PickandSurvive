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
      orderBy: [{ firstKickoff: 'asc' }, { number: 'asc' }],
    });

    if (overdueMatchdays.length === 0) return;

    // Group by leagueId — if the server was down and multiple days accumulated,
    // treat the whole batch as one deadline: a pick for ANY day in the batch
    // protects the player from no-pick elimination on all other days.
    const byLeague = new Map<string, typeof overdueMatchdays>();
    for (const md of overdueMatchdays) {
      if (!byLeague.has(md.leagueId)) byLeague.set(md.leagueId, []);
      byLeague.get(md.leagueId)!.push(md);
    }

    for (const [, matchdays] of byLeague) {
      const batchIds = matchdays.map((m) => m.id);
      const latest = matchdays[matchdays.length - 1];

      this.logger.log(
        `Processing deadline batch of ${matchdays.length} matchday(s) ending at round ${latest.number} (league ${latest.leagueId})`,
      );
      await this.pickProcessing.processNoPickDeadline(latest.id, batchIds);

      for (const matchday of matchdays) {
        await this.prisma.matchday.update({
          where: { id: matchday.id },
          data: { status: MatchdayStatus.ONGOING },
        });
      }
    }
  }

  /**
   * Midseason reset: when a matchday in the second half begins,
   * the FIRST-half TeamUsages no longer block picks in the SECOND half.
   * (This is handled at pick-time by resolvePickHalf, no DB action needed.)
   */
}
