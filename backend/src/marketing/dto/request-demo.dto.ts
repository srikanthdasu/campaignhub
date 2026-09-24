import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RequestDemoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  agencyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
