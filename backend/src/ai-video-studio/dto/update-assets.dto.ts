import { IsArray, IsString } from 'class-validator';

export class UpdateAssetsDto {
  @IsArray()
  @IsString({ each: true })
  assetIds: string[];
}
