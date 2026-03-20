import { IsEmail, IsNotEmpty } from 'class-validator';

export class InviteEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
