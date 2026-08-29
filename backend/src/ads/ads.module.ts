import { Module } from '@nestjs/common';
import { AdsService } from './ads.service.js';
import { AdsController } from './ads.controller.js';
import { AuditModule } from '../audit/audit.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [AdsController],
  providers: [AdsService],
})
export class AdsModule {}
