import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AzureAiFoundryService } from '../ai-common/azure-ai-foundry.service.js';
import { requireInClient } from '../common/require-in-client.js';
import { CreateStrategyDto } from './dto/create-strategy.dto.js';
import { ReviewStrategyDto } from './dto/review-strategy.dto.js';
import { FeedbackStrategyDto } from './dto/feedback-strategy.dto.js';
import { AiStrategyStatus, Role } from '../generated/prisma/client.js';
import type { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class AiStrategyService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private foundry: AzureAiFoundryService,
    private notifications: NotificationsService,
  ) {}

  // Mirrors ai-strategy.controller.ts's CAN_REVIEW list — agency-wide Owner/Admin plus whichever
  // Managers were specifically granted access to this client, i.e. everyone actually allowed to
  // call review() on a request for it.
  private async reviewerIdsForClient(clientId: string): Promise<string[]> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId }, select: { agencyId: true } });
    if (!client) return [];
    const [agencyWide, clientScoped] = await Promise.all([
      this.prisma.user.findMany({
        where: { agencyId: client.agencyId, role: { in: [Role.OWNER, Role.ADMIN] }, isActive: true },
        select: { id: true },
      }),
      this.prisma.userClientAccess.findMany({
        where: { clientId, user: { role: Role.MANAGER, isActive: true } },
        select: { userId: true },
      }),
    ]);
    return [...new Set([...agencyWide.map((u) => u.id), ...clientScoped.map((a) => a.userId)])];
  }

  async create(clientId: string, actorId: string, dto: CreateStrategyDto) {
    const context = dto.contextNote
      ? ({ note: dto.contextNote } as unknown as Prisma.InputJsonValue)
      : undefined;
    const request = await this.prisma.aiStrategyRequest.create({
      data: { clientId, title: dto.title, goal: dto.goal, context, createdById: actorId },
    });
    await this.audit.log({
      userId: actorId,
      action: 'AI_STRATEGY_CREATED',
      entityType: 'ai_strategy_request',
      entityId: request.id,
    });

    const reviewerIds = (await this.reviewerIdsForClient(clientId)).filter((id) => id !== actorId);
    await this.notifications.createMany(reviewerIds, `A new AI strategy request ("${dto.title}") needs review`, '/ai-strategy');

    return request;
  }

  list(clientId: string) {
    return this.prisma.aiStrategyRequest.findMany({
      where: { clientId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getOne(clientId: string, id: string) {
    await this.requireInClient(id, clientId);
    return this.prisma.aiStrategyRequest.findUnique({
      where: { id },
      include: { generations: { orderBy: { createdAt: 'desc' } } },
    });
  }

  async generate(clientId: string, id: string, actorId: string) {
    const request = await this.requireInClient(id, clientId);
    const contextNote = (request.context as { note?: string } | null)?.note;
    const output = await this.foundry.chat(
      [
        {
          role: 'system',
          content:
            'You are a social media marketing strategist. Write a concise, actionable strategy ' +
            'recommendation using only the context given — do not invent data about the client, ' +
            'their audience, or their past performance that was not provided.',
        },
        {
          role: 'user',
          content: [
            `Title: ${request.title}`,
            `Goal: ${request.goal || 'Not specified — treat this as a general growth strategy.'}`,
            contextNote ? `Additional context: ${contextNote}` : null,
            '',
            'Provide: a brief objective summary, then 3-5 numbered recommended actions.',
          ]
            .filter((line) => line !== null)
            .join('\n'),
        },
      ],
      { maxTokens: 500, temperature: 0.6 },
    );

    const [updated] = await this.prisma.$transaction([
      this.prisma.aiStrategyRequest.update({
        where: { id },
        data: { output, status: AiStrategyStatus.GENERATED },
      }),
      this.prisma.aiStrategyGeneration.create({ data: { requestId: id, output } }),
    ]);

    await this.audit.log({
      userId: actorId,
      action: 'AI_STRATEGY_GENERATED',
      entityType: 'ai_strategy_request',
      entityId: id,
    });

    return updated;
  }

  async review(clientId: string, id: string, actorId: string, dto: ReviewStrategyDto) {
    const request = await this.requireInClient(id, clientId);
    if (request.status !== AiStrategyStatus.GENERATED) {
      throw new BadRequestException('Only a generated strategy can be reviewed');
    }

    const updated = await this.prisma.aiStrategyRequest.update({
      where: { id },
      data: { status: dto.status, reviewNote: dto.reviewNote },
    });

    await this.audit.log({
      userId: actorId,
      action: dto.status === AiStrategyStatus.APPROVED ? 'AI_STRATEGY_APPROVED' : 'AI_STRATEGY_REJECTED',
      entityType: 'ai_strategy_request',
      entityId: id,
      metadata: { reviewNote: dto.reviewNote },
    });

    if (request.createdById && request.createdById !== actorId) {
      await this.notifications.create(
        request.createdById,
        `Your AI strategy request ("${request.title}") was ${dto.status === AiStrategyStatus.APPROVED ? 'approved' : 'rejected'}`,
        '/ai-strategy',
      );
    }

    return updated;
  }

  async feedback(clientId: string, id: string, actorId: string, dto: FeedbackStrategyDto) {
    await this.requireInClient(id, clientId);
    const updated = await this.prisma.aiStrategyRequest.update({
      where: { id },
      data: { feedbackRating: dto.rating },
    });

    await this.audit.log({
      userId: actorId,
      action: 'AI_STRATEGY_FEEDBACK',
      entityType: 'ai_strategy_request',
      entityId: id,
      metadata: { rating: dto.rating },
    });

    return updated;
  }

  async remove(clientId: string, id: string, actorId: string) {
    await this.requireInClient(id, clientId);
    await this.prisma.aiStrategyRequest.delete({ where: { id } });
    await this.audit.log({
      userId: actorId,
      action: 'AI_STRATEGY_DELETED',
      entityType: 'ai_strategy_request',
      entityId: id,
    });
  }

  private async requireInClient(id: string, clientId: string) {
    return requireInClient(() => this.prisma.aiStrategyRequest.findUnique({ where: { id } }), clientId, 'Strategy request');
  }
}
