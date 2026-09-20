import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailCampaignsService } from './email-campaigns.service.js';

@Injectable()
export class EmailCampaignsCronService {
  private readonly logger = new Logger(EmailCampaignsCronService.name);

  constructor(private emailCampaigns: EmailCampaignsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleQueuedCampaigns() {
    const count = await this.emailCampaigns.processQueuedCampaigns();
    if (count > 0) this.logger.log(`Sent ${count} campaign email(s)`);
  }
}
