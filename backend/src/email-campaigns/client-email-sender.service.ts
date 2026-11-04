import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { UpsertClientEmailSenderDto } from './dto/upsert-client-email-sender.dto.js';
import { ClientEmailSenderVerificationStatus, EmailRecipientStatus } from '../generated/prisma/client.js';

const BREVO_DOMAINS_URL = 'https://api.brevo.com/v3/senders/domains';

export interface BrevoDnsRecord {
  type: string;
  hostName: string;
  value: string;
  status: boolean;
}

interface BrevoDomainRegistration {
  id: string;
  dnsRecords: BrevoDnsRecord[];
}

// Each client's "send as" identity for email campaigns — separate from EmailService's single
// global platform sender, which this never touches. Degrades the same way SMTP/Storage/Sentry
// already do in this codebase: without BREVO_API_KEY configured, the sender row still saves
// (name/email/limits), just without the real Brevo domain-verification round trip — the admin UI
// shows "not configured" instead of DNS records, rather than the whole feature failing.
@Injectable()
export class ClientEmailSenderService {
  private readonly logger = new Logger(ClientEmailSenderService.name);
  private readonly brevoApiKey: string | undefined;

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    config: ConfigService,
  ) {
    this.brevoApiKey = config.get<string>('BREVO_API_KEY') || undefined;
  }

  private domainFromEmail(email: string): string {
    return email.split('@')[1]?.toLowerCase() ?? '';
  }

  getForClient(clientId: string) {
    return this.prisma.clientEmailSender.findUnique({ where: { clientId } });
  }

  async upsert(clientId: string, actorId: string, dto: UpsertClientEmailSenderDto) {
    const domain = this.domainFromEmail(dto.senderEmail);
    if (!domain) {
      throw new BadRequestException('senderEmail must be a valid address with a domain');
    }

    const existing = await this.prisma.clientEmailSender.findUnique({ where: { clientId } });
    const domainChanged = !existing || existing.domain !== domain;

    let providerDomainId = existing?.providerDomainId ?? null;
    let dnsRecords: BrevoDnsRecord[] | null = null;

    if (domainChanged && this.brevoApiKey) {
      const registration = await this.registerBrevoDomain(domain);
      if (registration) {
        providerDomainId = registration.id;
        dnsRecords = registration.dnsRecords;
      }
    } else if (domainChanged && !this.brevoApiKey) {
      this.logger.warn(
        `BREVO_API_KEY not configured — saving sender for client "${clientId}" without registering domain "${domain}" with Brevo.`,
      );
    }

    const sender = await this.prisma.clientEmailSender.upsert({
      where: { clientId },
      create: {
        clientId,
        senderName: dto.senderName,
        senderEmail: dto.senderEmail,
        domain,
        providerDomainId,
        dailySendLimit: dto.dailySendLimit,
        monthlySendLimit: dto.monthlySendLimit,
        createdById: actorId,
        // A fresh row always starts PENDING by schema default — explicit here only for clarity.
        verificationStatus: ClientEmailSenderVerificationStatus.PENDING,
      },
      update: {
        senderName: dto.senderName,
        senderEmail: dto.senderEmail,
        domain,
        providerDomainId,
        dailySendLimit: dto.dailySendLimit,
        monthlySendLimit: dto.monthlySendLimit,
        // Only reset verification when the domain actually changed — editing just the send
        // limits on an already-verified sender shouldn't force re-verification.
        ...(domainChanged
          ? { verificationStatus: ClientEmailSenderVerificationStatus.PENDING, verifiedAt: null }
          : {}),
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'CLIENT_EMAIL_SENDER_CONFIGURED',
      entityType: 'client_email_sender',
      entityId: sender.id,
      metadata: { clientId, senderEmail: dto.senderEmail, domainChanged },
    });

    return { sender, dnsRecords };
  }

  async checkVerification(clientId: string) {
    const sender = await this.prisma.clientEmailSender.findUnique({ where: { clientId } });
    if (!sender) {
      throw new NotFoundException('No email sender configured for this client');
    }

    if (!this.brevoApiKey) {
      return { sender, message: 'BREVO_API_KEY not configured — cannot check verification yet.' };
    }

    try {
      const res = await fetch(`${BREVO_DOMAINS_URL}/${encodeURIComponent(sender.domain)}/authenticate`, {
        method: 'PUT',
        headers: { 'api-key': this.brevoApiKey, 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const updated = await this.prisma.clientEmailSender.update({
          where: { clientId },
          data: { verificationStatus: ClientEmailSenderVerificationStatus.VERIFIED, verifiedAt: new Date() },
        });
        return { sender: updated, message: 'Domain verified.' };
      }

      // Most non-2xx responses at this point mean "DNS records aren't fully propagated/correct
      // yet" — a routine, expected state right after adding records, not a terminal failure. Stay
      // PENDING rather than flipping to FAILED, so a client who hasn't finished their DNS yet
      // just sees "still pending" and can retry once it propagates.
      const body = await res.text();
      this.logger.warn(`Brevo domain authenticate check for "${sender.domain}" not yet successful: ${body}`);
      return { sender, message: 'Not verified yet — check that all DNS records have propagated and try again.' };
    } catch (err) {
      this.logger.warn(
        `Failed to check Brevo verification for "${sender.domain}": ${err instanceof Error ? err.message : String(err)}`,
      );
      return { sender, message: 'Could not reach the email provider — try again shortly.' };
    }
  }

  /** Used by EmailCampaignsService — a verified sender to use, or null to fall back to the platform default. */
  async resolveSenderForSend(clientId: string): Promise<{ name: string; email: string } | null> {
    const sender = await this.prisma.clientEmailSender.findUnique({ where: { clientId } });
    if (!sender || sender.verificationStatus !== ClientEmailSenderVerificationStatus.VERIFIED) {
      return null;
    }
    return { name: sender.senderName, email: sender.senderEmail };
  }

  /** Throws if sending `count` more emails would exceed this client's configured daily/monthly limit. */
  async checkQuota(clientId: string, count: number): Promise<void> {
    const sender = await this.prisma.clientEmailSender.findUnique({ where: { clientId } });
    if (!sender || (!sender.dailySendLimit && !sender.monthlySendLimit)) {
      return;
    }

    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    if (sender.dailySendLimit) {
      const sentToday = await this.prisma.emailRecipient.count({
        where: { status: EmailRecipientStatus.SENT, sentAt: { gte: startOfDay }, campaign: { clientId } },
      });
      if (sentToday + count > sender.dailySendLimit) {
        throw new BadRequestException(
          `This would exceed the client's daily send limit (${sentToday}/${sender.dailySendLimit} already sent today).`,
        );
      }
    }

    if (sender.monthlySendLimit) {
      const sentThisMonth = await this.prisma.emailRecipient.count({
        where: { status: EmailRecipientStatus.SENT, sentAt: { gte: startOfMonth }, campaign: { clientId } },
      });
      if (sentThisMonth + count > sender.monthlySendLimit) {
        throw new BadRequestException(
          `This would exceed the client's monthly send limit (${sentThisMonth}/${sender.monthlySendLimit} already sent this month).`,
        );
      }
    }
  }

  private async registerBrevoDomain(domain: string): Promise<BrevoDomainRegistration | null> {
    try {
      const res = await fetch(BREVO_DOMAINS_URL, {
        method: 'POST',
        headers: { 'api-key': this.brevoApiKey!, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: domain }),
      });
      if (!res.ok) {
        this.logger.warn(`Brevo domain registration for "${domain}" failed: ${await res.text()}`);
        return null;
      }
      const body = (await res.json()) as {
        id?: number | string;
        dns_records?: Record<string, { type: string; host_name: string; value: string; status: boolean }>;
      };
      if (!body.dns_records || body.id === undefined) return null;
      return {
        id: String(body.id),
        dnsRecords: Object.values(body.dns_records).map((r) => ({
          type: r.type,
          hostName: r.host_name,
          value: r.value,
          status: r.status,
        })),
      };
    } catch (err) {
      this.logger.warn(
        `Failed to register domain "${domain}" with Brevo: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
