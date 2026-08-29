import { IsString, MinLength } from 'class-validator';

export class GenerateScriptDto {
  @IsString()
  @MinLength(1)
  idea: string;
}
