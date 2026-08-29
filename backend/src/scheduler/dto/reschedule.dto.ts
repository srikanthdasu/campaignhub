import { IsDateString } from 'class-validator';

export class RescheduleDto {
  @IsDateString()
  scheduledTime: string;
}
