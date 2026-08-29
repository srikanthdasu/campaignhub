import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsOptional } from 'class-validator';
import { SocialPlatform } from '../../generated/prisma/client.js';

export class CreateScheduleDto {
  @IsDateString()
  scheduledTime: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(SocialPlatform, { each: true })
  platforms?: SocialPlatform[];
}
