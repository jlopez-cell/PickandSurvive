import { Body, Controller, Param, Post, Request, UseGuards } from '@nestjs/common';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SocialService } from './social.service';

class ApplyBlockDto {
  @IsString()
  @IsNotEmpty()
  targetParticipantId: string;

  @IsInt()
  @Min(1)
  matchdayNumber: number;
}

class ApplyVetoDto {
  @IsString()
  @IsNotEmpty()
  targetParticipantId: string;

  @IsString()
  @IsNotEmpty()
  teamId: string;

  @IsInt()
  @Min(1)
  matchdayNumber: number;
}

class ApplyChallengeDto {
  @IsString()
  @IsNotEmpty()
  targetParticipantId: string;

  @IsInt()
  @Min(1)
  matchdayNumber: number;
}

@Controller('editions/:editionId')
@UseGuards(JwtAuthGuard)
export class SocialController {
  constructor(private readonly service: SocialService) {}

  @Post('blocks')
  applyBlock(
    @Request() req,
    @Param('editionId') editionId: string,
    @Body() dto: ApplyBlockDto,
  ) {
    return this.service.applyBlock(req.user.sub, editionId, dto.targetParticipantId, dto.matchdayNumber);
  }

  @Post('vetos')
  applyVeto(
    @Request() req,
    @Param('editionId') editionId: string,
    @Body() dto: ApplyVetoDto,
  ) {
    return this.service.applyVeto(req.user.sub, editionId, dto.targetParticipantId, dto.teamId, dto.matchdayNumber);
  }

  @Post('challenges')
  applyChallenge(
    @Request() req,
    @Param('editionId') editionId: string,
    @Body() dto: ApplyChallengeDto,
  ) {
    return this.service.applyChallenge(req.user.sub, editionId, dto.targetParticipantId, dto.matchdayNumber);
  }
}
