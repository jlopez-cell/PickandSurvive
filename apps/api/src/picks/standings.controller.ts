import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StandingsService } from './standings.service';

@Controller('editions/:editionId/standings')
@UseGuards(JwtAuthGuard)
export class StandingsController {
  constructor(private readonly service: StandingsService) {}

  @Get()
  getStandings(@Request() req, @Param('editionId') editionId: string) {
    return this.service.getStandings(req.user.sub, editionId);
  }
}
