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

  /**
   * Returns whether the message actually went out over SMTP — existing callers that only need
   * "best effort, never throws" can keep awaiting this and ignoring the result unchanged. Added
   * for bulk email campaigns, which need a real sent/failed signal per recipient to report back
   * to the agency, rather than silently treating every attempt as successful.
   *
   * `sender` is optional and per-call only — when provided (a client's own verified
   * ClientEmailSender identity), it overrides `this.from` for just this one message; every
   * existing caller that omits it keeps using the platform default unchanged.
   *
   * `html` is likewise optional and per-call only — when omitted, nodemailer sends a plain-text
   * message exactly as before. Added so email campaigns can render a real "Unsubscribe" button;
   * `text` is always sent alongside it as the fallback for clients that don't render HTML.
   */
  async send(
    to: string,
    subject: string,
    text: string,
    sender?: { name: string; email: string },
    html?: string,
  ): Promise<boolean> {
    const from = sender ? `"${sender.name}" <${sender.email}>` : this.from;
    if (!this.transporter) {
      this.logger.log(`[email not configured] would send to ${to}: "${subject}"`);
      return false;
    }
    try {
      await this.transporter.sendMail({ from, to, subject, text, ...(html ? { html } : {}) });
      return true;
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }
}
