import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { AdminService } from './admin.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { UpdateLeagueDto } from './dto/update-league.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('leagues')
  getLeagues() {
    return this.service.getLeagues();
  }

  @Post('leagues')
  createLeague(@Body() dto: CreateLeagueDto) {
    return this.service.createLeague(dto);
  }

  @Put('leagues/:id')
  updateLeague(@Param('id') id: string, @Body() dto: UpdateLeagueDto) {
    return this.service.updateLeague(id, dto);
  }

  @Get('leagues/:id/teams')
  getTeamsByLeague(@Param('id') id: string) {
    return this.service.getTeamsByLeague(id);
  }

  @Post('leagues/:id/sync')
  syncLeague(@Param('id') id: string) {
    return this.service.syncLeague(id);
  }

  @Post('sync-fixtures')
  syncFixtures() {
    return this.service.syncFixtures();
  }

  @Get('system/status')
  getSystemStatus() {
    return this.service.getSystemStatus();
  }
}
