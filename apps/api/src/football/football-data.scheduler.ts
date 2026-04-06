import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { FootballDataService } from './football-data.service';

/**
 * Intervalo entre sincronizaciones de resultados (solo backend → API externa → BD).
 * El frontend solo lee la base de datos.
 *
 * Variable: FOOTBALL_RESULT_SYNC_MINUTES (por defecto 30). Ej.: 90 para cada 90 min.
 * Mínimo 5 min para evitar errores de configuración.
 */
const DEFAULT_RESULT_SYNC_MINUTES = 30;
const MIN_RESULT_SYNC_MINUTES = 5;
const MAX_RESULT_SYNC_MINUTES = 24 * 60;

@Injectable()
export class FootballDataScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FootballDataScheduler.name);
  private readonly finishedSyncIntervalName = 'footballFinishedResultsSync';

  constructor(
    private readonly footballData: FootballDataService,
    private readonly config: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  /** Daily at 3:00 AM — sync upcoming fixtures for next 30 days */
  @Cron('0 3 * * *')
  async dailyFixtureSync() {
    this.logger.log('Starting daily fixture sync...');
    await this.footballData.syncUpcomingFixtures();
  }

  onModuleInit() {
    const raw = this.config.get<string>('FOOTBALL_RESULT_SYNC_MINUTES');
    const parsed = raw != null && String(raw).trim() !== '' ? Number.parseInt(String(raw).trim(), 10) : NaN;
    const minutes = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, MIN_RESULT_SYNC_MINUTES), MAX_RESULT_SYNC_MINUTES)
      : DEFAULT_RESULT_SYNC_MINUTES;

    const ms = minutes * 60 * 1000;

    this.logger.log(
      `Resultados de partidos finalizados: sincronización con API externa cada ${minutes} min → Postgres (la app no llama al proveedor).`,
    );

    const handle = setInterval(() => {
      void this.runFinishedMatchSync();
    }, ms);
    this.schedulerRegistry.addInterval(this.finishedSyncIntervalName, handle);

    // Una pasada al arrancar para no esperar al primer tick (una sola petición al proveedor).
    void this.runFinishedMatchSync();
  }

  onModuleDestroy() {
    try {
      this.schedulerRegistry.deleteInterval(this.finishedSyncIntervalName);
    } catch {
      // ya eliminado o no registrado
    }
  }

  private async runFinishedMatchSync() {
    try {
      await this.footballData.processFinishedMatches();
    } catch (err) {
      this.logger.error(`processFinishedMatches: ${(err as Error).message}`);
    }
  }
}
