import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateAgencyDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
