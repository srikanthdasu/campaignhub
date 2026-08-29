import { IsArray, IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Role } from '../../generated/prisma/client.js';

export class CreateMemberDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @IsString()
  @MinLength(10)
  @MaxLength(200)
  password: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  clientIds?: string[];
}
