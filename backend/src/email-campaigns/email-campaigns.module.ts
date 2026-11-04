import { Module } from '@nestjs/common';
import { EmailCampaignsService } from './email-campaigns.service.js';
import { EmailCampaignsController } from './email-campaigns.controller.js';
import { EmailCampaignsCronService } from './email-campaigns-cron.service.js';
import { UnsubscribeController } from './unsubscribe.controller.js';
import { ClientEmailSenderService } from './client-email-sender.service.js';
import { ClientEmailSenderController } from './client-email-sender.controller.js';
import { AuditModule } from '../audit/audit.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [EmailCampaignsController, UnsubscribeController, ClientEmailSenderController],
  providers: [EmailCampaignsService, EmailCampaignsCronService, ClientEmailSenderService],
})
export class EmailCampaignsModule {}
