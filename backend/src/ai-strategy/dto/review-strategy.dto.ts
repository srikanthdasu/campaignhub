import { IsIn, IsOptional, IsString } from 'class-validator';
import { AiStrategyStatus } from '../../generated/prisma/client.js';

export class ReviewStrategyDto {
  @IsIn([AiStrategyStatus.APPROVED, AiStrategyStatus.REJECTED])
  status: AiStrategyStatus;

  @IsOptional()
  @IsString()
  reviewNote?: string;
}
