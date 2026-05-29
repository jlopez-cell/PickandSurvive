import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WcSyncService } from './wc-sync.service';
import { WcSyncScheduler } from './wc-sync.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { PicksModule } from '../picks/picks.module';

@Module({
  imports: [
    HttpModule.register({ timeout: 10000, maxRedirects: 3 }),
    PrismaModule,
    forwardRef(() => PicksModule),
  ],
  providers: [WcSyncService, WcSyncScheduler],
  exports: [WcSyncService],
})
export class WorldCupModule {}
