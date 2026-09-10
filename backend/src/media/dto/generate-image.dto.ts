import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

// Matches the sizes DALL-E-3-style image APIs (including MAI-Image) actually accept — square,
// portrait, and landscape. There is no arbitrary-dimension support, so "Custom" in the UI maps
// to the closest of these rather than an unvalidated width/height pair.
export enum ImageSize {
  SQUARE = '1024x1024',
  PORTRAIT = '1024x1792',
  LANDSCAPE = '1792x1024',
}

export class GenerateImageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  prompt: string;

  @IsOptional()
  @IsEnum(ImageSize)
  size?: ImageSize;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  folder?: string;

  @IsOptional()
  @IsUUID('4')
  campaignId?: string;
}
