import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FootballDataService } from './football-data.service';

@Injectable()
export class FootballDataScheduler {
  private readonly logger = new Logger(FootballDataScheduler.name);

  constructor(private readonly footballData: FootballDataService) {}

  /** Daily at 3:00 AM — sync upcoming fixtures for next 30 days */
  @Cron('0 3 * * *')
  async dailyFixtureSync() {
    this.logger.log('Starting daily fixture sync...');
    await this.footballData.syncUpcomingFixtures();
  }

  /** Every 5 minutes — process finished matches and update results */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async resultProcessingCron() {
    await this.footballData.processFinishedMatches();
  }
}
