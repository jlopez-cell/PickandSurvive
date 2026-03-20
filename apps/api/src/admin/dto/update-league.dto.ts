import { IsString, IsNotEmpty, IsInt, IsPositive, IsOptional } from 'class-validator';

export class UpdateLeagueDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  country?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  totalMatchdaysPerSeason?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  currentSeason?: number;
}
