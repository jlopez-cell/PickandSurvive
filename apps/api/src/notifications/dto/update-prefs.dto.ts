import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdatePrefsDto {
  @IsBoolean()
  @IsOptional()
  emailEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  pushEnabled?: boolean;

  @IsString()
  @IsOptional()
  pushSubscriptionJson?: string | null;
}
