import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { SocialPlatform } from '../../generated/prisma/client.js';

export class CreateAdDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  objective?: string;

  @IsEnum(SocialPlatform)
  platform: SocialPlatform;

  @IsOptional()
  @IsUUID()
  campaignId?: string;
}
