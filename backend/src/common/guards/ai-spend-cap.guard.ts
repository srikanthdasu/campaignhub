import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../types/authenticated-user.js';

const DEFAULT_DAILY_CAP = 500;

/**
 * AI-1: the only cost control on AI generation used to be two binary global kill switches — no
 * per-agency limit at all, on a feature that resells access to a metered Azure provider. This is
 * a coarse, request-count cap (not exact token/dollar tracking — that's a larger follow-up, see
 * AiUsageLog's doc comment), applied per calendar day per agency, reset at UTC midnight.
 *
 * Deliberately generous by default so no real agency hits it under normal use — this is an
 * emergency backstop against a runaway client, a retry storm, or bad-faith usage, not a
 * plan-tier billing feature.
 */
@Injectable()
export class AiSpendCapGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    // JwtAuthGuard already ran by this point in every real request — this is just defense in
    // depth, matching the same no-user-means-let-it-through-to-the-next-check pattern used
    // elsewhere (e.g. ClientContentCreationGuard).
    if (!user?.agencyId) return true;

    const dailyCap = Number(this.config.get<string>('AI_DAILY_GENERATION_CAP_PER_AGENCY')) || DEFAULT_DAILY_CAP;

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);

    const count = await this.prisma.aiUsageLog.count({
      where: { agencyId: user.agencyId, createdAt: { gte: since } },
    });
    if (count >= dailyCap) {
      throw new ServiceUnavailableException(
        `This agency has reached today's AI generation limit (${dailyCap}). It resets at midnight UTC.`,
      );
    }

    await this.prisma.aiUsageLog.create({ data: { agencyId: user.agencyId } });
    return true;
  }
}
