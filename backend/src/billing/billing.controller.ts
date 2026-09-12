import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service.js';
import { SubscribeDto } from './dto/subscribe.dto.js';
import { ConfirmCheckoutDto } from './dto/confirm-checkout.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Public } from '../common/decorators/public.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const CAN_VIEW = [Role.OWNER, Role.ADMIN];

@Controller('billing')
@UseGuards(RolesGuard)
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Get('plans')
  getPlans() {
    return this.billingService.getPlans();
  }

  @Get('subscription')
  @Roles(...CAN_VIEW)
  getSubscription(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.getSubscription(user.agencyId!);
  }

  @Get('invoices')
  @Roles(...CAN_VIEW)
  listInvoices(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.listInvoices(user.agencyId!);
  }

  @Post('checkout')
  @Roles(Role.OWNER)
  createCheckoutOrder(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubscribeDto) {
    return this.billingService.createCheckoutOrder(user.agencyId!, dto);
  }

  @Post('checkout/verify')
  @Roles(Role.OWNER)
  confirmSubscription(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConfirmCheckoutDto) {
    return this.billingService.confirmSubscription(user.agencyId!, user.sub, dto);
  }

  @Post('cancel')
  @Roles(Role.OWNER)
  cancel(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.cancel(user.agencyId!, user.sub);
  }

  // No @Roles() here is intentional, not an oversight (see the C1 audit finding this pattern
  // caused elsewhere) — Razorpay calls this directly with no user session at all, so there is no
  // request.user/role to check. Its real gate is the HMAC signature verified inside the service
  // against req.rawBody, which only the real Razorpay (holding RAZORPAY_WEBHOOK_SECRET) can
  // produce — that's the authentication for this route, just not the JWT/role kind.
  @Public()
  @Post('webhooks/razorpay')
  @HttpCode(HttpStatus.OK)
  razorpayWebhook(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers['x-razorpay-signature'];
    if (typeof signature !== 'string' || !req.rawBody) {
      throw new BadRequestException('Missing webhook signature or body');
    }
    return this.billingService.processRazorpayWebhook(req.rawBody, signature);
  }
}
