import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WcPicksService } from './wc-picks.service';

@Controller('wc/editions/:editionId')
@UseGuards(JwtAuthGuard)
export class WcPicksController {
  constructor(private readonly service: WcPicksService) {}

  @Get('today')
  getToday(@Request() req, @Param('editionId') editionId: string) {
    return this.service.getTodayContext(req.user.sub, editionId);
  }

  @Get('groups')
  getGroups(@Param('editionId') editionId: string) {
    return this.service.getGroupStandings(editionId);
  }

  @Get('participants')
  getParticipants(@Param('editionId') editionId: string) {
    return this.service.getParticipants(editionId);
  }
}
