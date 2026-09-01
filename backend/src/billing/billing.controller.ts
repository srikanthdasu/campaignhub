import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { SubscribeDto } from './dto/subscribe.dto.js';
import { ConfirmCheckoutDto } from './dto/confirm-checkout.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
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
}
