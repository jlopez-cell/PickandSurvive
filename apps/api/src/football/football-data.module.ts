import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FootballDataService } from './football-data.service';
import { FootballDataScheduler } from './football-data.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { PicksModule } from '../picks/picks.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
    PrismaModule,
    forwardRef(() => PicksModule),
  ],
  providers: [FootballDataService, FootballDataScheduler],
  exports: [FootballDataService],
})
export class FootballDataModule {}
