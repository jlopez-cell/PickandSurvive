import { IsString, IsNotEmpty, IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { ChampionshipMode } from '@prisma/client';

export class CreateChampionshipDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  footballLeagueId: string;

  @IsEnum(ChampionshipMode)
  mode: ChampionshipMode;

  @IsBoolean()
  @IsOptional()
  pickResetAtMidseason?: boolean;
}
