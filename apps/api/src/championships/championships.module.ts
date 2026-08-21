import { Module } from '@nestjs/common';
import { ChampionshipsController, LeaguesController } from './championships.controller';
import { ChampionshipsService } from './championships.service';
import { ChampionshipAdminGuard } from './championship-admin.guard';
import { EditionsScheduler } from './editions.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [LeaguesController, ChampionshipsController],
  providers: [ChampionshipsService, ChampionshipAdminGuard, EditionsScheduler],
  exports: [ChampionshipsService],
})
export class ChampionshipsModule {}
