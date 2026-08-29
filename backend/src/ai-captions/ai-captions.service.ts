import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AzureAiFoundryService } from '../ai-common/azure-ai-foundry.service.js';
import { parseModelJson } from '../ai-common/parse-model-json.js';
import { GenerateCaptionsDto } from './dto/generate-captions.dto.js';
import { SaveCaptionDto } from './dto/save-caption.dto.js';

export interface CaptionVariant {
  text: string;
  hashtags: string[];
}

const VARIANT_COUNT = 3;

function buildPrompt(input: string, tone: string, platform?: string): string {
  return [
    `Write ${VARIANT_COUNT} distinct social media caption variants for the following, in a ${tone} tone` +
      (platform ? ` for ${platform}` : '') +
      '.',
    'Each variant must be a short, ready-to-post caption (1-3 sentences) plus 3-5 relevant hashtags.',
    '',
    `Content: """${input}"""`,
    '',
    'Respond with ONLY a JSON array, no prose, no markdown code fences, in exactly this shape:',
    '[{"text": "...", "hashtags": ["#example", "#example2"]}]',
  ].join('\n');
}

function isCaptionVariants(value: unknown): value is CaptionVariant[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (v): v is CaptionVariant =>
        typeof v === 'object' &&
        v !== null &&
        typeof (v as CaptionVariant).text === 'string' &&
        Array.isArray((v as CaptionVariant).hashtags) &&
        (v as CaptionVariant).hashtags.every((h) => typeof h === 'string'),
    )
  );
}

@Injectable()
export class AiCaptionsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private foundry: AzureAiFoundryService,
  ) {}

  async generate(dto: GenerateCaptionsDto): Promise<CaptionVariant[]> {
    const tone = dto.tone ?? 'Friendly';
    const raw = await this.foundry.chat(
      [
        {
          role: 'system',
          content: 'You are a social media copywriter. Respond with only valid JSON, nothing else.',
        },
        { role: 'user', content: buildPrompt(dto.input, tone, dto.platform) },
      ],
      { maxTokens: 500, temperature: 0.8 },
    );
    return parseModelJson(raw, isCaptionVariants);
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
