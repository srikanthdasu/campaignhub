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

// FEAT-3: BrandKit (voice guidelines, brand rules, AI context) was fully built — CRUD service,
// schema, an admin form for voiceGuidelines — and never read by any AI generation feature. This
// is the "clearest, most direct win" the audit called it: inject what's actually there into the
// prompt. brandRules/aiContext have no frontend form yet (only voiceGuidelines does), but are
// included when present since the schema/DTO already support setting them directly via the API.
function buildBrandVoiceSection(kit: { voiceGuidelines: string | null; aiContext: string | null; brandRules: unknown } | null): string | null {
  if (!kit) return null;
  const lines: string[] = [];
  if (kit.voiceGuidelines) lines.push(`Voice and tone guidelines: ${kit.voiceGuidelines}`);
  if (kit.aiContext) lines.push(`Additional brand context: ${kit.aiContext}`);
  if (kit.brandRules && typeof kit.brandRules === 'object' && Object.keys(kit.brandRules).length > 0) {
    lines.push(`Brand rules to follow: ${JSON.stringify(kit.brandRules)}`);
  }
  if (lines.length === 0) return null;
  return `This client has a defined brand voice — follow it even where it varies from the requested tone below:\n${lines.join('\n')}`;
}

function buildPrompt(input: string, tone: string, platform: string | undefined, brandVoice: string | null): string {
  return [
    brandVoice,
    brandVoice ? '' : null,
    `Write ${VARIANT_COUNT} distinct social media caption variants for the following, in a ${tone} tone` +
      (platform ? ` for ${platform}` : '') +
      '.',
    'Each variant must be a short, ready-to-post caption (1-3 sentences) plus 3-5 relevant hashtags.',
    '',
    `Content: """${input}"""`,
    '',
    'Respond with ONLY a JSON array, no prose, no markdown code fences, in exactly this shape:',
    '[{"text": "...", "hashtags": ["#example", "#example2"]}]',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
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

  async generate(clientId: string, actorId: string, dto: GenerateCaptionsDto): Promise<CaptionVariant[]> {
    const tone = dto.tone ?? 'Friendly';
    const kit = await this.prisma.brandKit.findUnique({ where: { clientId } });
    const brandVoice = buildBrandVoiceSection(kit);
    const raw = await this.foundry.chat(
      [
        {
          role: 'system',
          content: 'You are a social media copywriter. Respond with only valid JSON, nothing else.',
        },
        { role: 'user', content: buildPrompt(dto.input, tone, dto.platform, brandVoice) },
      ],
      { maxTokens: 500, temperature: 0.8 },
    );
    const variants = parseModelJson(raw, isCaptionVariants);

    // AI-2: this is the billable call — AI_CAPTION_SAVED (below, in save()) only fires for
    // variants the user actually keeps, so without this there's no record of generation calls
    // that were never saved.
    await this.audit.log({
      userId: actorId,
      action: 'AI_CAPTION_GENERATED',
      entityType: 'ai_caption',
      metadata: { tone, platform: dto.platform },
    });

    return variants;
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
