import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectSendDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
