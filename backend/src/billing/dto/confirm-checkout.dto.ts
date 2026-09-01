import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { SubscriptionPlan } from '../../generated/prisma/client.js';

export class ConfirmCheckoutDto {
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;

  @IsIn(['MONTHLY', 'YEARLY'])
  billingCycle: 'MONTHLY' | 'YEARLY';

  @IsOptional()
  @IsString()
  gstNumber?: string;

  @IsString()
  orderId: string;

  @IsString()
  paymentId: string;

  @IsString()
  signature: string;
}
