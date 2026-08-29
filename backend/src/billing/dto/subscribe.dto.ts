import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { SubscriptionPlan } from '../../generated/prisma/client.js';

export class SubscribeDto {
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;

  @IsIn(['MONTHLY', 'YEARLY'])
  billingCycle: 'MONTHLY' | 'YEARLY';

  @IsOptional()
  @IsString()
  gstNumber?: string;
}
