import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { simulateStrategyOutput } from '../ai-common/simulated-ai.js';
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
    const output = simulateStrategyOutput(request.title, request.goal ?? '', contextNote);

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
