import { Module } from '@nestjs/common';
import { PicksController } from './picks.controller';
import { StandingsController } from './standings.controller';
import { PicksService } from './picks.service';
import { StandingsService } from './standings.service';
import { PickProcessingService } from './pick-processing.service';
import { EditionResolutionService } from './edition-resolution.service';
import { PotDistributionService } from './pot-distribution.service';
import { PicksScheduler } from './picks.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { SocialModule } from '../social/social.module';

@Module({
  imports: [PrismaModule, SocialModule],
  controllers: [PicksController, StandingsController],
  providers: [
    PicksService,
    StandingsService,
    PickProcessingService,
    EditionResolutionService,
    PotDistributionService,
    PicksScheduler,
  ],
  exports: [PickProcessingService],
})
export class PicksModule {}
