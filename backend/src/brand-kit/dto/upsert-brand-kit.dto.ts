import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpsertBrandKitDto {
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @IsOptional()
  @IsObject()
  fonts?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  voiceGuidelines?: string;

  @IsOptional()
  @IsObject()
  brandRules?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  aiContext?: string;
}
