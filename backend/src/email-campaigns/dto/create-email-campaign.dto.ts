import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateEmailCampaignDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  subject: string;

  @IsString()
  @MinLength(2)
  bodyTemplate: string;
}
