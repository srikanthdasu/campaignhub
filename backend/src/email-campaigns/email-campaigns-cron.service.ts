import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailCampaignsService } from './email-campaigns.service.js';

@Injectable()
export class EmailCampaignsCronService {
  private readonly logger = new Logger(EmailCampaignsCronService.name);
  // A single NestJS instance runs this trigger, so this in-memory flag only prevents the SAME
  // process from starting a second overlapping run (e.g. a large batch still sending when the
  // next EVERY_MINUTE tick fires) — it provides no protection across multiple instances. That
  // protection is the atomic per-recipient claim in
  // EmailCampaignsService.processQueuedCampaigns() (PENDING -> SENT, conditioned on the row still
  // being PENDING), which is what actually prevents a duplicate send either way.
  private isRunning = false;

  constructor(private emailCampaigns: EmailCampaignsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleQueuedCampaigns() {
    if (this.isRunning) {
      this.logger.warn('Skipping this tick — the previous campaign-send run is still in progress');
      return;
    }
    this.isRunning = true;
    try {
      const count = await this.emailCampaigns.processQueuedCampaigns();
      if (count > 0) this.logger.log(`Sent ${count} campaign email(s)`);
    } finally {
      this.isRunning = false;
    }
  }
}
