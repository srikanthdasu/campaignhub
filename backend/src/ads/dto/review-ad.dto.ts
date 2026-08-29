import { IsIn, IsOptional, IsString } from 'class-validator';
import { AdStatus } from '../../generated/prisma/client.js';

export class ReviewAdDto {
  @IsIn([AdStatus.APPROVED, AdStatus.REJECTED])
  status: AdStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
