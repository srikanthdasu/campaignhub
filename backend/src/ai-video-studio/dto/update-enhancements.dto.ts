import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateEnhancementsDto {
  @IsOptional()
  @IsBoolean()
  autoCut?: boolean;

  @IsOptional()
  @IsBoolean()
  smoothTransitions?: boolean;

  @IsOptional()
  @IsBoolean()
  autoCaptions?: boolean;

  @IsOptional()
  @IsBoolean()
  colorCorrection?: boolean;

  @IsOptional()
  @IsBoolean()
  brandWatermark?: boolean;

  @IsOptional()
  @IsString()
  backgroundMusic?: string;
}
