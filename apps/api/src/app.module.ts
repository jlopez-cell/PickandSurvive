import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ChampionshipsModule } from './championships/championships.module';
import { FootballDataModule } from './football/football-data.module';
import { PicksModule } from './picks/picks.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { WorldCupModule } from './world-cup/world-cup.module';
import { SocialModule } from './social/social.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    ChampionshipsModule,
    FootballDataModule,
    PicksModule,
    NotificationsModule,
    AdminModule,
    WorldCupModule,
    SocialModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
