import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateEmailCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  subject?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  bodyTemplate?: string;
}
