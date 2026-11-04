import { IsEmail, IsInt, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class UpsertClientEmailSenderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  senderName: string;

  @IsEmail()
  @MaxLength(255)
  senderEmail: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  dailySendLimit?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  monthlySendLimit?: number;
}
