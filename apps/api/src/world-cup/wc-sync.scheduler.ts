import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WcSyncService } from './wc-sync.service';

const WC_START = new Date('2026-06-11T00:00:00Z');
const WC_END   = new Date('2026-07-20T00:00:00Z');

@Injectable()
export class WcSyncScheduler {
  private readonly logger = new Logger(WcSyncScheduler.name);

  constructor(private readonly wc: WcSyncService) {}

  private isWcActive(): boolean {
    const now = Date.now();
    return now >= WC_START.getTime() && now <= WC_END.getTime();
  }

  // Sync calendario completo y standings una vez al día a las 2:00 AM
  @Cron('0 2 * * *')
  async dailySync() {
    this.logger.log('Daily WC sync starting...');
    await this.wc.syncWcTeams();
    await this.wc.syncWcMatches();
    await this.wc.syncWcStandings();
  }

  // Procesar resultados cada 5 minutos durante el Mundial
  @Cron('*/5 * * * *')
  async resultsSync() {
    if (!this.isWcActive()) return;
    await this.wc.processFinishedWcMatches();
  }

  // Sync de standings cada hora durante el Mundial (grupos cambian tras cada partido)
  @Cron('0 * * * *')
  async standingsSync() {
    if (!this.isWcActive()) return;
    await this.wc.syncWcStandings();
  }
}
