import { IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { SocialPlatform } from '../../generated/prisma/client.js';

export class CreateCampaignDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  objective?: string;

  @IsOptional()
  @IsString()
  goal?: string;

  @IsOptional()
  @IsString()
  kpi?: string;

  @IsOptional()
  @IsInt()
  target?: number;

  @IsOptional()
  @IsArray()
  @IsEnum(SocialPlatform, { each: true })
  platforms?: SocialPlatform[];

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
