import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

/**
 * Real outbound email — via any standard SMTP account (Gmail app password, SendGrid/SES SMTP
 * relay, a company mailbox, etc.), not tied to one paid provider's SDK. Degrades honestly: if
 * SMTP_HOST/PORT/USER/PASSWORD aren't all set, this logs what it would have sent instead of
 * failing the caller — email is a best-effort channel layered on top of in-app notifications,
 * not the source of truth, so a misconfigured/down mail server should never break the app.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const port = config.get<string>('SMTP_PORT');
    const user = config.get<string>('SMTP_USER');
    const password = config.get<string>('SMTP_PASSWORD');
    this.from = config.get<string>('SMTP_FROM') ?? '"CampaignHub AI" <no-reply@campaignhub.ai>';

    if (host && port && user && password) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: Number(port) === 465,
        auth: { user, pass: password },
      });
    } else {
      this.transporter = null;
      this.logger.warn(
        'SMTP not configured (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD) — emails will be logged, not sent.',
      );
    }
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[email not configured] would send to ${to}: "${subject}"`);
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text });
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
