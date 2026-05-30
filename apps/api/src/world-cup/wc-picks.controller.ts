import { Controller, Get, Post, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WcPicksService } from './wc-picks.service';
import { WcSyncService } from './wc-sync.service';

@Controller('wc')
@UseGuards(JwtAuthGuard)
export class WcPicksController {
  constructor(
    private readonly service: WcPicksService,
    private readonly sync: WcSyncService,
  ) {}

  @Post('sync')
  async triggerSync() {
    await this.sync.syncWcTeams();
    await this.sync.syncWcMatches();
    await this.sync.syncWcStandings();
    return { ok: true, message: 'Sync completado' };
  }

  @Get('editions/:editionId/today')
  getToday(
    @Request() req,
    @Param('editionId') editionId: string,
    @Query('matchday') matchday?: string,
  ) {
    const md = matchday ? Number(matchday) : undefined;
    return this.service.getTodayContext(req.user.sub, editionId, Number.isFinite(md) ? md : undefined);
  }

  @Get('editions/:editionId/groups')
  getGroups(@Param('editionId') editionId: string) {
    return this.service.getGroupStandings(editionId);
  }

  @Get('editions/:editionId/participants')
  getParticipants(@Param('editionId') editionId: string) {
    return this.service.getParticipants(editionId);
  }
}
