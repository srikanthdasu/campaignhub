import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SceneDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsInt()
  @Min(1)
  durationSec: number;
}

export class UpdateStoryboardDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SceneDto)
  scenes: SceneDto[];
}
