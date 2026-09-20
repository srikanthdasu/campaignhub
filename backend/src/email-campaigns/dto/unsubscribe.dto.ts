import { IsString, MinLength } from 'class-validator';

export class UnsubscribeDto {
  @IsString()
  @MinLength(32)
  token: string;
}
