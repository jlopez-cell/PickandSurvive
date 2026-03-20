import { IsInt, IsPositive, IsOptional, Min } from 'class-validator';

export class CreateEditionDto {
  @IsInt()
  @IsPositive()
  startMatchday: number;

  @IsInt()
  @IsPositive()
  @IsOptional()
  endMatchday?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  potAmountCents?: number;
}
