import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { SocialPlatform } from '../../generated/prisma/client.js';

export class CreateSocialAccountDto {
  @IsEnum(SocialPlatform)
  platform: SocialPlatform;

  @IsString()
  @MinLength(1)
  label: string;

  @IsOptional()
  @IsString()
  externalAccountId?: string;
}
