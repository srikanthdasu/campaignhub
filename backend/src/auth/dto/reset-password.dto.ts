import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(32)
  token: string;

  @IsString()
  @MinLength(10)
  newPassword: string;
}
