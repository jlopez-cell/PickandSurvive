import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PicksService } from './picks.service';
import { CreatePickDto } from './dto/create-pick.dto';

@Controller('editions/:editionId')
@UseGuards(JwtAuthGuard)
export class PicksController {
  constructor(private readonly service: PicksService) {}

  @Post('picks')
  createPick(
    @Request() req,
    @Param('editionId') editionId: string,
    @Body() dto: CreatePickDto,
  ) {
    return this.service.createPick(req.user.sub, editionId, dto);
  }

  @Get('picks')
  getPicksForMatchday(
    @Request() req,
    @Param('editionId') editionId: string,
    @Query('matchday') matchday: string,
  ) {
    return this.service.getPicksForMatchday(
      req.user.sub,
      editionId,
      parseInt(matchday, 10),
    );
  }

  @Get('picks/history')
  getPicksHistory(@Request() req, @Param('editionId') editionId: string) {
    return this.service.getPicksHistory(req.user.sub, editionId);
  }

  @Get('teams')
  getAvailableTeams(
    @Request() req,
    @Param('editionId') editionId: string,
    @Query('matchday') matchday: string,
  ) {
    return this.service.getAvailableTeams(
      req.user.sub,
      editionId,
      parseInt(matchday, 10),
    );
  }

  @Get('matches')
  getMatchesForMatchday(
    @Request() req,
    @Param('editionId') editionId: string,
    @Query('matchday') matchday: string,
  ) {
    return this.service.getMatchesForMatchday(
      req.user.sub,
      editionId,
      parseInt(matchday, 10),
    );
  }

  @Get('meta')
  getEditionMeta(@Param('editionId') editionId: string) {
    return this.service.getEditionMeta(editionId);
  }

  @Get('deadline')
  getEditionDeadline(@Param('editionId') editionId: string) {
    return this.service.getEditionDeadline(editionId);
  }
}
