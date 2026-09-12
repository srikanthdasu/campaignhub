import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
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

  // Set by the frontend when this content is created directly from an AI Caption/AI Image
  // Studio output being used as-is — the backend has no reliable way to infer this on its own
  // (a generic "create content" call has no provenance info unless the caller declares it).
  @IsOptional()
  @IsBoolean()
  aiGenerated?: boolean;
}
