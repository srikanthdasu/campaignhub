import { IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { SocialPlatform } from '../../generated/prisma/client.js';

export class SaveCaptionDto {
  @IsString()
  @MinLength(1)
  input: string;

  @IsOptional()
  @IsString()
  tone?: string;

  @IsOptional()
  @IsEnum(SocialPlatform)
  platform?: SocialPlatform;

  @IsString()
  @MinLength(1)
  text: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashtags?: string[];
}
