import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class RecipientRowDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsEmail()
  @MaxLength(255)
  email: string;
}

export class BulkImportRecipientsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => RecipientRowDto)
  recipients: RecipientRowDto[];
}
