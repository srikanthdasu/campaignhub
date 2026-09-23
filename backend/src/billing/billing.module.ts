import { Module } from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { BillingController } from './billing.controller.js';
import { RazorpayService } from './razorpay.service.js';
import { AuditModule } from '../audit/audit.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [BillingController],
  providers: [BillingService, RazorpayService],
})
export class BillingModule {}
