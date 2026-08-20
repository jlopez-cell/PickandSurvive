import { IsString, IsNotEmpty, IsInt, IsPositive, IsOptional, IsIn, IsBoolean } from 'class-validator';
import { PickType } from '@prisma/client';

export class CreatePickDto {
  @IsString()
  @IsNotEmpty()
  teamId: string;

  @IsInt()
  @IsPositive()
  matchdayNumber: number;

  @IsOptional()
  @IsIn([PickType.WIN, PickType.WIN_OR_DRAW])
  pickType?: PickType;

  @IsBoolean()
  @IsOptional()
  isDoubleOrNothing?: boolean;
}
