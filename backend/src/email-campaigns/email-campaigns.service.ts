import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { EmailService } from '../notifications/email.service.js';
import { CreateEmailCampaignDto } from './dto/create-email-campaign.dto.js';
import { UpdateEmailCampaignDto } from './dto/update-email-campaign.dto.js';
import { BulkImportRecipientsDto } from './dto/bulk-import-recipients.dto.js';
import { EmailCampaignStatus, EmailRecipientStatus } from '../generated/prisma/client.js';

const DEFAULT_BATCH_SIZE = 20;
const MERGE_FIELD = /\{\{\s*name\s*\}\}/gi;

@Injectable()
export class EmailCampaignsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private email: EmailService,
    private config: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async create(clientId: string, actorId: string, dto: CreateEmailCampaignDto) {
    const campaign = await this.prisma.emailCampaign.create({
      data: {
        clientId,
        name: dto.name,
        subject: dto.subject,
        bodyTemplate: dto.bodyTemplate,
        createdById: actorId,
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'EMAIL_CAMPAIGN_CREATED',
      entityType: 'email_campaign',
      entityId: campaign.id,
    });

    return campaign;
  }

  list(clientId: string) {
    return this.prisma.emailCampaign.findMany({
      where: { clientId },
      include: { _count: { select: { recipients: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOne(clientId: string, id: string) {
    const campaign = await this.requireInClient(id, clientId);
    return this.prisma.emailCampaign.findUnique({
      where: { id: campaign.id },
      include: { recipients: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async update(clientId: string, id: string, actorId: string, dto: UpdateEmailCampaignDto) {
    const campaign = await this.requireInClient(id, clientId);
    if (campaign.status !== EmailCampaignStatus.DRAFT) {
      throw new BadRequestException('Only draft campaigns can be edited');
    }

    const updated = await this.prisma.emailCampaign.update({
      where: { id },
      data: { name: dto.name, subject: dto.subject, bodyTemplate: dto.bodyTemplate },
    });

    await this.audit.log({
      userId: actorId,
      action: 'EMAIL_CAMPAIGN_UPDATED',
      entityType: 'email_campaign',
      entityId: id,
    });

    return updated;
  }

  async remove(clientId: string, id: string, actorId: string) {
    const campaign = await this.requireInClient(id, clientId);
    if (campaign.status !== EmailCampaignStatus.DRAFT) {
      throw new BadRequestException('Only draft campaigns can be deleted');
    }

    await this.prisma.emailCampaign.delete({ where: { id } });
    await this.audit.log({
      userId: actorId,
      action: 'EMAIL_CAMPAIGN_DELETED',
      entityType: 'email_campaign',
      entityId: id,
    });
  }

  // The unsubscribe token is deliberately NOT generated here — only its hash could ever be
  // stored, so generating it now would throw away the one and only copy of the raw value before
  // it's ever used in an email. It's generated at send time instead, in processQueuedCampaigns(),
  // right when it's actually needed for the outgoing link.
  async bulkImportRecipients(
    clientId: string,
    campaignId: string,
    actorId: string,
    dto: BulkImportRecipientsDto,
  ) {
    const campaign = await this.requireInClient(campaignId, clientId);
    if (campaign.status !== EmailCampaignStatus.DRAFT) {
      throw new BadRequestException('Recipients can only be added while the campaign is still a draft');
    }

    const seen = new Set<string>();
    const deduped = dto.recipients.filter((r) => {
      const key = r.email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const suppressed = await this.prisma.emailUnsubscribe.findMany({
      where: { clientId, email: { in: deduped.map((r) => r.email.toLowerCase()) } },
      select: { email: true },
    });
    const suppressedSet = new Set(suppressed.map((u) => u.email.toLowerCase()));

    const rows = deduped.map((r) => ({
      campaignId,
      name: r.name,
      email: r.email,
      status: suppressedSet.has(r.email.toLowerCase())
        ? EmailRecipientStatus.UNSUBSCRIBED
        : EmailRecipientStatus.PENDING,
    }));

    await this.prisma.emailRecipient.createMany({ data: rows });

    const skipped = rows.filter((r) => r.status === EmailRecipientStatus.UNSUBSCRIBED).length;

    await this.audit.log({
      userId: actorId,
      action: 'EMAIL_CAMPAIGN_RECIPIENTS_IMPORTED',
      entityType: 'email_campaign',
      entityId: campaignId,
      metadata: { count: rows.length, alreadyUnsubscribed: skipped },
    });

    return { imported: rows.length, skippedAsUnsubscribed: skipped };
  }

  async removeRecipient(clientId: string, campaignId: string, recipientId: string, actorId: string) {
    const campaign = await this.requireInClient(campaignId, clientId);
    if (campaign.status !== EmailCampaignStatus.DRAFT) {
      throw new BadRequestException('Recipients can only be removed while the campaign is still a draft');
    }
    const recipient = await this.prisma.emailRecipient.findUnique({ where: { id: recipientId } });
    if (!recipient || recipient.campaignId !== campaignId) {
      throw new NotFoundException('Recipient not found on this campaign');
    }

    await this.prisma.emailRecipient.delete({ where: { id: recipientId } });
    await this.audit.log({
      userId: actorId,
      action: 'EMAIL_CAMPAIGN_RECIPIENT_REMOVED',
      entityType: 'email_campaign',
      entityId: campaignId,
    });
  }

  async send(clientId: string, id: string, actorId: string) {
    const campaign = await this.requireInClient(id, clientId);
    if (campaign.status !== EmailCampaignStatus.DRAFT) {
      throw new BadRequestException('This campaign has already been queued or sent');
    }

    const pendingCount = await this.prisma.emailRecipient.count({
      where: { campaignId: id, status: EmailRecipientStatus.PENDING },
    });
    if (pendingCount === 0) {
      throw new BadRequestException(
        'Add at least one recipient who is not already unsubscribed before sending',
      );
    }

    const queued = await this.prisma.emailCampaign.update({
      where: { id },
      data: { status: EmailCampaignStatus.QUEUED, queuedAt: new Date() },
    });

    await this.audit.log({
      userId: actorId,
      action: 'EMAIL_CAMPAIGN_QUEUED',
      entityType: 'email_campaign',
      entityId: id,
      metadata: { recipientCount: pendingCount },
    });

    return queued;
  }

  /**
   * Called by EmailCampaignsCronService — no user in the loop, so no access check or actor on
   * the audit entries (mirrors SchedulerService.autoPublishDuePosts()'s exact same comment/
   * pattern). Works through PENDING recipients a batch at a time so 100 emails never block an
   * HTTP request and never look like a spam blast to the SMTP provider.
   */
  async processQueuedCampaigns(): Promise<number> {
    const batchSize = Number(this.config.get<string>('EMAIL_CAMPAIGN_BATCH_SIZE')) || DEFAULT_BATCH_SIZE;
    const appUrl = this.config.get<string>('PUBLIC_APP_URL') ?? 'http://localhost:3000';

    const campaigns = await this.prisma.emailCampaign.findMany({
      where: { status: { in: [EmailCampaignStatus.QUEUED, EmailCampaignStatus.SENDING] } },
    });

    let totalSent = 0;

    for (const campaign of campaigns) {
      if (campaign.status === EmailCampaignStatus.QUEUED) {
        await this.prisma.emailCampaign.update({
          where: { id: campaign.id },
          data: { status: EmailCampaignStatus.SENDING },
        });
      }

      const pending = await this.prisma.emailRecipient.findMany({
        where: { campaignId: campaign.id, status: EmailRecipientStatus.PENDING },
        take: batchSize,
      });

      for (const recipient of pending) {
        // Safety-net re-check: they may have unsubscribed from a different campaign to this
        // same client in the time between queueing and this send.
        const stillSuppressed = await this.prisma.emailUnsubscribe.findUnique({
          where: { clientId_email: { clientId: campaign.clientId, email: recipient.email.toLowerCase() } },
        });
        if (stillSuppressed) {
          await this.prisma.emailRecipient.update({
            where: { id: recipient.id },
            data: { status: EmailRecipientStatus.UNSUBSCRIBED },
          });
          continue;
        }

        const rawToken = randomBytes(32).toString('hex');
        const unsubscribeLink = `${appUrl}/unsubscribe?token=${rawToken}`;
        const body =
          campaign.bodyTemplate.replace(MERGE_FIELD, recipient.name) +
          `\n\n---\nDon't want these emails? Unsubscribe: ${unsubscribeLink}`;

        const delivered = await this.email.send(recipient.email, campaign.subject, body);

        await this.prisma.emailRecipient.update({
          where: { id: recipient.id },
          data: delivered
            ? { status: EmailRecipientStatus.SENT, sentAt: new Date(), unsubscribeTokenHash: this.hashToken(rawToken) }
            : { status: EmailRecipientStatus.FAILED, errorMessage: 'Delivery failed or SMTP not configured' },
        });
        if (delivered) totalSent++;
      }

      const remainingPending = await this.prisma.emailRecipient.count({
        where: { campaignId: campaign.id, status: EmailRecipientStatus.PENDING },
      });
      if (remainingPending === 0) {
        await this.prisma.emailCampaign.update({
          where: { id: campaign.id },
          data: { status: EmailCampaignStatus.SENT, sentAt: new Date() },
        });
      }
    }

    return totalSent;
  }

  /** Public (unauthenticated) — GET side of unsubscribe, info only, never mutates state. */
  async findByUnsubscribeToken(token: string) {
    const tokenHash = this.hashToken(token);
    const recipient = await this.prisma.emailRecipient.findUnique({
      where: { unsubscribeTokenHash: tokenHash },
      include: { campaign: { include: { client: { select: { name: true } } } } },
    });
    if (!recipient) throw new NotFoundException('This unsubscribe link is invalid.');
    return recipient;
  }

  /** Public (unauthenticated) — POST side of unsubscribe, the only step that actually mutates. */
  async confirmUnsubscribe(token: string) {
    const recipient = await this.findByUnsubscribeToken(token);
    const clientId = recipient.campaign.clientId;

    // Idempotent — clicking twice (or a second campaign already having unsubscribed the same
    // email) is a normal, expected case, not an error.
    await this.prisma.emailUnsubscribe.upsert({
      where: { clientId_email: { clientId, email: recipient.email.toLowerCase() } },
      create: { clientId, email: recipient.email.toLowerCase() },
      update: {},
    });

    if (recipient.status !== EmailRecipientStatus.UNSUBSCRIBED) {
      await this.prisma.emailRecipient.update({
        where: { id: recipient.id },
        data: { status: EmailRecipientStatus.UNSUBSCRIBED },
      });
    }

    return { email: recipient.email, clientName: recipient.campaign.client.name };
  }

  private async requireInClient(id: string, clientId: string) {
    const campaign = await this.prisma.emailCampaign.findUnique({ where: { id } });
    if (!campaign || campaign.clientId !== clientId) {
      throw new NotFoundException('Email campaign not found for this client');
    }
    return campaign;
  }
}
