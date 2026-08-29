import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsUUID('4')
  brandKitId?: string;
}
