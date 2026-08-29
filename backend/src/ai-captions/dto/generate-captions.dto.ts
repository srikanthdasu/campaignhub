import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { SocialPlatform } from '../../generated/prisma/client.js';

export class GenerateCaptionsDto {
  @IsString()
  @MinLength(1)
  input: string;

  @IsOptional()
  @IsString()
  tone?: string;

  @IsOptional()
  @IsEnum(SocialPlatform)
  platform?: SocialPlatform;
}
