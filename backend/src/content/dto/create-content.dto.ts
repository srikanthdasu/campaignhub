import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ContentType, SocialPlatform } from '../../generated/prisma/client.js';

export class CreateContentDto {
  @IsEnum(ContentType)
  type: ContentType;

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

  @IsOptional()
  @IsUUID('4')
  campaignId?: string;
}
