import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../notifications/email.service.js';

@Injectable()
export class MarketingService {
  constructor(
    private config: ConfigService,
    private email: EmailService,
  ) {}

  // Lightweight by design — no DB record, just an email to whoever's watching
  // DEMO_REQUEST_EMAIL. Distinct from the DemoLead model, which tracks people using the shared
  // self-serve demo login, not people asking for a live walkthrough call.
  async requestDemo(name: string, email: string, agencyName?: string, message?: string) {
    const notifyEmail = this.config.getOrThrow<string>('DEMO_REQUEST_EMAIL');
    const appUrl = this.config.getOrThrow<string>('PUBLIC_APP_URL');

    await this.email.send(
      notifyEmail,
      `Demo request: ${name}${agencyName ? ` (${agencyName})` : ''}`,
      [
        `Name: ${name}`,
        `Email: ${email}`,
        agencyName ? `Agency: ${agencyName}` : null,
        message ? `Message:\n${message}` : null,
      ]
        .filter(Boolean)
        .join('\n\n'),
    );

    await this.email.send(
      email,
      'We got your demo request — CampaignHub AI',
      `Hi ${name},\n\nThanks for reaching out — we'll be in touch shortly to set up a time.\n\nIn the meantime, you're welcome to try CampaignHub AI yourself at any point: ${appUrl}.\n\n— The CampaignHub AI team`,
    );

    return { message: 'Thanks — we’ll be in touch shortly.' };
  }
}
