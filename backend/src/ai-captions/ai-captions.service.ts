import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { simulateCaptionVariants } from '../ai-common/simulated-ai.js';
import { GenerateCaptionsDto } from './dto/generate-captions.dto.js';
import { SaveCaptionDto } from './dto/save-caption.dto.js';

@Injectable()
export class AiCaptionsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  generate(dto: GenerateCaptionsDto) {
    return simulateCaptionVariants(dto.input, dto.tone ?? 'Friendly', dto.platform);
  }

  async save(clientId: string, actorId: string, dto: SaveCaptionDto) {
    const caption = await this.prisma.aiCaption.create({
      data: {
        clientId,
        input: dto.input,
        tone: dto.tone ?? 'Friendly',
        platform: dto.platform,
        text: dto.text,
        hashtags: dto.hashtags ?? [],
        createdById: actorId,
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'AI_CAPTION_SAVED',
      entityType: 'ai_caption',
      entityId: caption.id,
    });

    return caption;
  }

  async list(clientId: string) {
    return this.prisma.aiCaption.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(clientId: string, id: string, actorId: string) {
    const caption = await this.prisma.aiCaption.findUnique({ where: { id } });
    if (!caption || caption.clientId !== clientId) {
      throw new NotFoundException('Caption not found for this client');
    }
    await this.prisma.aiCaption.delete({ where: { id } });
    await this.audit.log({
      userId: actorId,
      action: 'AI_CAPTION_DELETED',
      entityType: 'ai_caption',
      entityId: id,
    });
  }
}
