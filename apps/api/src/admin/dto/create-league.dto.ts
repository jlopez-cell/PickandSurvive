import { IsString, IsNotEmpty, IsInt, IsPositive } from 'class-validator';

export class CreateLeagueDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsInt()
  @IsPositive()
  apiFootballId: number;

  @IsInt()
  @IsPositive()
  totalMatchdaysPerSeason: number;

  @IsInt()
  @IsPositive()
  currentSeason: number;
}
