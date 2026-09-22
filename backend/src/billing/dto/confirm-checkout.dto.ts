import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { SubscriptionPlan } from '../../generated/prisma/client.js';

// plan/billingCycle/gstNumber below are accepted but no longer used to decide what gets
// activated — BillingService.confirmSubscription re-derives all three from the verified
// Razorpay order's own notes instead, since trusting these fields directly let a signature
// valid for one plan be replayed with a different plan substituted in the request body (the
// signature only proves orderId+paymentId are real, never what plan they were for). Kept here,
// required, purely so the existing frontend request shape stays valid without a matching change.
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
