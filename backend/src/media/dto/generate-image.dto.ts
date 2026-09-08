import { IsString, MinLength } from 'class-validator';

export class GenerateImageDto {
  @IsString()
  @MinLength(1)
  prompt: string;
}
