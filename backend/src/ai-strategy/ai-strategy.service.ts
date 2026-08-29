import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AzureAiFoundryService } from '../ai-common/azure-ai-foundry.service.js';
import { CreateStrategyDto } from './dto/create-strategy.dto.js';
import { ReviewStrategyDto } from './dto/review-strategy.dto.js';
import { FeedbackStrategyDto } from './dto/feedback-strategy.dto.js';
import { AiStrategyStatus } from '../generated/prisma/client.js';
import type { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class AiStrategyService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private foundry: AzureAiFoundryService,
  ) {}

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
    return request;
  }

  list(clientId: string) {
    return this.prisma.aiStrategyRequest.findMany({
      where: { clientId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getOne(clientId: string, id: string) {
    return this.requireInClient(id, clientId);
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

    const updated = await this.prisma.aiStrategyRequest.update({
      where: { id },
      data: { output, status: AiStrategyStatus.GENERATED },
    });

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
    const request = await this.prisma.aiStrategyRequest.findUnique({ where: { id } });
    if (!request || request.clientId !== clientId) {
      throw new NotFoundException('Strategy request not found for this client');
    }
    return request;
  }
}
