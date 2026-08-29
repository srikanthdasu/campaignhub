import { IsString, MinLength } from 'class-validator';

export class ExportVideoDto {
  @IsString()
  @MinLength(1)
  format: string;
}
