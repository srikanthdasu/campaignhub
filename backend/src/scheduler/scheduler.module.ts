import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service.js';
import { SchedulerCronService } from './scheduler-cron.service.js';
import { SchedulerController } from './scheduler.controller.js';
import { InstagramPublishService } from '../social-accounts/instagram-publish.service.js';
import { AuditModule } from '../audit/audit.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { MediaModule } from '../media/media.module.js';

@Module({
  imports: [AuditModule, NotificationsModule, MediaModule],
  controllers: [SchedulerController],
  providers: [SchedulerService, SchedulerCronService, InstagramPublishService],
})
export class SchedulerModule {}
