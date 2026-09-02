import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateSocialAccountDto } from './dto/create-social-account.dto.js';
import { encryptToken } from './token-crypto.js';
import { SocialPlatform } from '../generated/prisma/client.js';

const SAFE_SELECT = {
  id: true,
  platform: true,
  label: true,
  externalAccountId: true,
  connectedAt: true,
  // token columns intentionally excluded — never returned to the frontend
} as const;

@Injectable()
export class SocialAccountsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private config: ConfigService,
  ) {}

  /** Real OAuth connection — the access token is encrypted at rest, never returned to the client (see SAFE_SELECT). */
  async createFromOAuth(
    clientId: string,
    actorId: string,
    platform: SocialPlatform,
    label: string,
    externalAccountId: string,
    accessToken: string,
  ) {
    const encryptionKey = this.config.getOrThrow<string>('TOKEN_ENCRYPTION_KEY');
    const account = await this.prisma.socialAccount.upsert({
      where: { clientId_platform_externalAccountId: { clientId, platform, externalAccountId } },
      create: {
        clientId,
        platform,
        label,
        externalAccountId,
        accessTokenEncrypted: encryptToken(accessToken, encryptionKey),
        connectedById: actorId,
      },
      update: {
        label,
        accessTokenEncrypted: encryptToken(accessToken, encryptionKey),
        connectedById: actorId,
        connectedAt: new Date(),
      },
      select: SAFE_SELECT,
    });

    await this.audit.log({
      userId: actorId,
      action: 'SOCIAL_ACCOUNT_CONNECTED',
      entityType: 'social_account',
      entityId: account.id,
      metadata: { platform, label, oauth: true },
    });

    return account;
  }

  async create(clientId: string, actorId: string, dto: CreateSocialAccountDto) {
    const account = await this.prisma.socialAccount.create({
      data: {
        clientId,
        platform: dto.platform,
        label: dto.label,
        externalAccountId: dto.externalAccountId,
        connectedById: actorId,
      },
      select: SAFE_SELECT,
    });

    await this.audit.log({
      userId: actorId,
      action: 'SOCIAL_ACCOUNT_CONNECTED',
      entityType: 'social_account',
      entityId: account.id,
      metadata: { platform: dto.platform, label: dto.label },
    });

    return account;
  }

  async list(clientId: string) {
    return this.prisma.socialAccount.findMany({
      where: { clientId },
      select: SAFE_SELECT,
      orderBy: { connectedAt: 'desc' },
    });
  }

  async remove(clientId: string, id: string, actorId: string) {
    const account = await this.prisma.socialAccount.findUnique({ where: { id } });
    if (!account || account.clientId !== clientId) {
      throw new NotFoundException('Social account not found for this client');
    }

    await this.prisma.socialAccount.delete({ where: { id } });
    await this.audit.log({
      userId: actorId,
      action: 'SOCIAL_ACCOUNT_REMOVED',
      entityType: 'social_account',
      entityId: id,
      metadata: { platform: account.platform, label: account.label },
    });
  }
}
