import { Module } from '@nestjs/common';
import { MarketingController } from './marketing.controller.js';
import { MarketingService } from './marketing.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [NotificationsModule],
  controllers: [MarketingController],
  providers: [MarketingService],
})
export class MarketingModule {}
