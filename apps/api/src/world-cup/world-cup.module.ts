import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WcSyncService } from './wc-sync.service';
import { WcSyncScheduler } from './wc-sync.scheduler';
import { WcPicksService } from './wc-picks.service';
import { WcPicksController } from './wc-picks.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PicksModule } from '../picks/picks.module';

@Module({
  imports: [
    HttpModule.register({ timeout: 10000, maxRedirects: 3 }),
    PrismaModule,
    forwardRef(() => PicksModule),
  ],
  controllers: [WcPicksController],
  providers: [WcSyncService, WcSyncScheduler, WcPicksService],
  exports: [WcSyncService],
})
export class WorldCupModule {}
