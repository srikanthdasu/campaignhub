import { IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateMediaDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  folder?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  // null clears the campaign link (IsOptional skips validation for both undefined and null,
  // so this is the one case where "not provided" and "explicitly cleared" need to differ).
  @IsOptional()
  @IsUUID('4')
  campaignId?: string | null;
}
