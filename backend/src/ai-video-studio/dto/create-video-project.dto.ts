import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateVideoProjectDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  idea?: string;
}
