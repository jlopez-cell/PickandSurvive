import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FootballDataModule } from '../football/football-data.module';

@Module({
  imports: [PrismaModule, FootballDataModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
