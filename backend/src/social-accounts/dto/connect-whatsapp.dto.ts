import { IsString, MinLength } from 'class-validator';

export class ConnectWhatsAppDto {
  @IsString()
  @MinLength(1)
  code: string;

  @IsString()
  @MinLength(1)
  phoneNumberId: string;
}
