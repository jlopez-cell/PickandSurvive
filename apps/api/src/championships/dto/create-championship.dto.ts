import { IsString, IsNotEmpty, IsEnum, IsBoolean, IsOptional, IsInt, Min } from 'class-validator';
import { ChampionshipMode } from '@prisma/client';

export class CreateChampionshipDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  footballLeagueId?: string;

  @IsEnum(ChampionshipMode)
  mode: ChampionshipMode;

  @IsBoolean()
  @IsOptional()
  pickResetAtMidseason?: boolean;

  @IsBoolean()
  @IsOptional()
  streakBonusEnabled?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  wildcardCount?: number;

  @IsBoolean()
  @IsOptional()
  ghostModeEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  socialPressureEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  doubleOrNothingEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  underdogBonusEnabled?: boolean;
}
