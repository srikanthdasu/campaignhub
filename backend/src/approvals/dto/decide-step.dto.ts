import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApprovalDecision } from '../../generated/prisma/client.js';

export class DecideStepDto {
  @IsEnum(ApprovalDecision)
  decision: ApprovalDecision;

  @IsOptional()
  @IsString()
  comment?: string;
}
