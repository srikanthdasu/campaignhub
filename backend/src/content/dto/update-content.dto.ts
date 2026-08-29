import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { SocialPlatform } from '../../generated/prisma/client.js';

export class UpdateContentDto {
  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(SocialPlatform, { each: true })
  platforms?: SocialPlatform[];

  @IsOptional()
  @IsUUID('4')
  mediaAssetId?: string;
}
