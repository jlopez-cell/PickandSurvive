import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
  Patch,
} from '@nestjs/common';
import { ChampionshipsService } from './championships.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChampionshipAdminGuard } from './championship-admin.guard';
import { CreateChampionshipDto } from './dto/create-championship.dto';
import { CreateEditionDto } from './dto/create-edition.dto';
import { InviteEmailDto } from './dto/invite-email.dto';
import { JoinRequestStatus } from '@prisma/client';

@Controller('leagues')
@UseGuards(JwtAuthGuard)
export class LeaguesController {
  constructor(private readonly service: ChampionshipsService) {}

  @Get()
  getLeagues() {
    return this.service.getLeagues();
  }
}

@Controller('championships')
@UseGuards(JwtAuthGuard)
export class ChampionshipsController {
  constructor(private readonly service: ChampionshipsService) {}

  // ─── Campeonatos ────────────────────────────────────────────────────────

  @Post()
  createChampionship(@Request() req, @Body() dto: CreateChampionshipDto) {
    return this.service.createChampionship(req.user.sub, dto);
  }

  @Get()
  getMyChampionships(@Request() req) {
    return this.service.getMyChampionships(req.user.sub);
  }

  @Get(':id')
  getChampionshipById(@Request() req, @Param('id') id: string) {
    return this.service.getChampionshipById(req.user.sub, id);
  }

  // ─── Ediciones ──────────────────────────────────────────────────────────

  @Post(':id/editions')
  @UseGuards(ChampionshipAdminGuard)
  createEdition(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: CreateEditionDto,
  ) {
    return this.service.createEdition(req.user.sub, id, dto);
  }

  @Patch(':id/editions/:editionId/publish')
  @UseGuards(ChampionshipAdminGuard)
  publishEdition(
    @Request() req,
    @Param('id') id: string,
    @Param('editionId') editionId: string,
  ) {
    return this.service.publishEdition(req.user.sub, id, editionId);
  }

  @Patch(':id/editions/:editionId/activate')
  @UseGuards(ChampionshipAdminGuard)
  activateEdition(
    @Request() req,
    @Param('id') id: string,
    @Param('editionId') editionId: string,
  ) {
    return this.service.activateEdition(req.user.sub, id, editionId);
  }

  // ─── Invitaciones ────────────────────────────────────────────────────────

  @Post(':id/invite-link')
  @UseGuards(ChampionshipAdminGuard)
  generateInviteLink(@Param('id') id: string) {
    return this.service.generateInviteLink(id);
  }

  @Post(':id/invite-email')
  @UseGuards(ChampionshipAdminGuard)
  sendInviteEmail(@Param('id') id: string, @Body() dto: InviteEmailDto) {
    return this.service.sendInviteEmail(id, dto);
  }

  // ─── Unirse con token ────────────────────────────────────────────────────

  @Post('join/:token')
  joinByToken(@Request() req, @Param('token') token: string) {
    return this.service.joinByToken(req.user.sub, token);
  }

  // ─── Solicitudes de Unión ─────────────────────────────────────────────────

  @Get(':id/join-requests')
  @UseGuards(ChampionshipAdminGuard)
  getJoinRequests(
    @Param('id') id: string,
    @Query('status') status?: JoinRequestStatus,
  ) {
    return this.service.getJoinRequests(id, status);
  }

  @Post(':id/join-requests/:requestId/approve')
  @UseGuards(ChampionshipAdminGuard)
  approveJoinRequest(
    @Request() req,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
  ) {
    return this.service.approveJoinRequest(req.user.sub, id, requestId);
  }

  @Post(':id/join-requests/:requestId/reject')
  @UseGuards(ChampionshipAdminGuard)
  rejectJoinRequest(
    @Request() req,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
  ) {
    return this.service.rejectJoinRequest(req.user.sub, id, requestId);
  }

  // ─── Abandono ─────────────────────────────────────────────────────────────

  @Delete(':id/leave')
  leaveChampionship(@Request() req, @Param('id') id: string) {
    return this.service.leaveChampionship(req.user.sub, id);
  }

  // ─── Eliminación (admin) ───────────────────────────────────────────────

  @Delete(':id')
  @UseGuards(ChampionshipAdminGuard)
  deleteChampionship(@Request() req, @Param('id') id: string) {
    return this.service.deleteChampionship(req.user.sub, id);
  }
}
