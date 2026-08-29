import { IsEnum, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MinLength } from 'class-validator';
import { SocialPlatform } from '../../generated/prisma/client.js';

export class UpdateAdDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  objective?: string;

  @IsOptional()
  @IsEnum(SocialPlatform)
  platform?: SocialPlatform;

  @IsOptional()
  @IsString()
  audienceNotes?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  budgetAmount?: number;

  @IsOptional()
  @IsString()
  budgetCurrency?: string;

  @IsOptional()
  @IsString()
  creativeText?: string;

  @IsOptional()
  @IsUUID()
  creativeMediaAssetId?: string;
}
