import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApprovalMode } from '../../generated/prisma/client.js';

export class SubmitContentDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  approverIds: string[];

  @IsOptional()
  @IsEnum(ApprovalMode)
  mode?: ApprovalMode;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
