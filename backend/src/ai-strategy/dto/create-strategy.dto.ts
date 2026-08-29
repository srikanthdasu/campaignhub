import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStrategyDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  goal?: string;

  @IsOptional()
  @IsString()
  contextNote?: string;
}
