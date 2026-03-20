import { IsString, IsNotEmpty, IsInt, IsPositive } from 'class-validator';

export class CreatePickDto {
  @IsString()
  @IsNotEmpty()
  teamId: string;

  @IsInt()
  @IsPositive()
  matchdayNumber: number;
}
