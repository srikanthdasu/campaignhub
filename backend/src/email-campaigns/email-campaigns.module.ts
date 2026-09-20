import { Module } from '@nestjs/common';
import { EmailCampaignsService } from './email-campaigns.service.js';
import { EmailCampaignsController } from './email-campaigns.controller.js';
import { EmailCampaignsCronService } from './email-campaigns-cron.service.js';
import { UnsubscribeController } from './unsubscribe.controller.js';
import { AuditModule } from '../audit/audit.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [EmailCampaignsController, UnsubscribeController],
  providers: [EmailCampaignsService, EmailCampaignsCronService],
})
export class EmailCampaignsModule {}
