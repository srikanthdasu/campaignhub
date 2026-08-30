import { randomUUID } from 'crypto';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AzureAiFoundryService } from '../ai-common/azure-ai-foundry.service.js';
import { parseModelJson } from '../ai-common/parse-model-json.js';
import { UPLOAD_DIR } from '../media/media-storage.js';
import { CreateVideoProjectDto } from './dto/create-video-project.dto.js';
import { GenerateScriptDto } from './dto/generate-script.dto.js';
import { UpdateStoryboardDto } from './dto/update-storyboard.dto.js';
import { UpdateAssetsDto } from './dto/update-assets.dto.js';
import { UpdateEnhancementsDto } from './dto/update-enhancements.dto.js';
import { ExportVideoDto } from './dto/export-video.dto.js';
import { AiVideoStep } from '../generated/prisma/client.js';
import type { Prisma } from '../generated/prisma/client.js';

// No Google Cloud / Vertex AI credentials are configured (spec itself notes the Veo provider
// choice is undecided pending GCP credit confirmation), so "export" produces a placeholder
// instead of a real video file. Script generation and the render preview image both call real
// models (Azure AI Foundry); storyboard/asset selection/enhancements are user-driven, not
// AI-generated, so there's nothing to simulate there either way.

interface ScriptScene {
  title: string;
  description: string;
  durationSec: number;
}

interface ScriptResult {
  script: string;
  scenes: ScriptScene[];
}

function isScriptResult(value: unknown): value is ScriptResult {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as ScriptResult;
  return (
    typeof v.script === 'string' &&
    Array.isArray(v.scenes) &&
    v.scenes.length > 0 &&
    v.scenes.every(
      (s) => typeof s.title === 'string' && typeof s.description === 'string' && typeof s.durationSec === 'number',
    )
  );
}

@Injectable()
export class AiVideoStudioService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private foundry: AzureAiFoundryService,
  ) {}

  async create(clientId: string, actorId: string, dto: CreateVideoProjectDto) {
    const project = await this.prisma.aiVideoProject.create({
      data: { clientId, title: dto.title, idea: dto.idea, createdById: actorId },
    });
    await this.audit.log({
      userId: actorId,
      action: 'AI_VIDEO_PROJECT_CREATED',
      entityType: 'ai_video_project',
      entityId: project.id,
    });
    return project;
  }

  list(clientId: string) {
    return this.prisma.aiVideoProject.findMany({
      where: { clientId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getOne(clientId: string, id: string) {
    return this.requireInClient(id, clientId);
  }

  async generateScript(clientId: string, id: string, dto: GenerateScriptDto) {
    await this.requireInClient(id, clientId);

    const raw = await this.foundry.chat(
      [
        {
          role: 'system',
          content:
            'You are a short-form social video scriptwriter. Respond with only valid JSON, nothing else.',
        },
        {
          role: 'user',
          content: [
            `Write a short-form video script for this idea: """${dto.idea}"""`,
            'Break it into 3-5 scenes, each a few seconds long, totaling under 30 seconds.',
            '',
            'Respond with ONLY a JSON object, no prose, no markdown code fences, in exactly this shape:',
            '{"script": "full script as plain text with scene labels", "scenes": [{"title": "...", "description": "...", "durationSec": 4}]}',
          ].join('\n'),
        },
      ],
      { maxTokens: 700, temperature: 0.7 },
    );
    const { script, scenes } = parseModelJson(raw, isScriptResult);

    return this.prisma.aiVideoProject.update({
      where: { id },
      data: { idea: dto.idea, script, scenes: scenes as unknown as Prisma.InputJsonValue, step: AiVideoStep.SCRIPT },
    });
  }

  async updateStoryboard(clientId: string, id: string, dto: UpdateStoryboardDto) {
    await this.requireInClient(id, clientId);
    return this.prisma.aiVideoProject.update({
      where: { id },
      data: {
        scenes: dto.scenes as unknown as Prisma.InputJsonValue,
        step: AiVideoStep.STORYBOARD,
      },
    });
  }

  async updateAssets(clientId: string, id: string, dto: UpdateAssetsDto) {
    await this.requireInClient(id, clientId);
    return this.prisma.aiVideoProject.update({
      where: { id },
      data: {
        assets: dto.assetIds as unknown as Prisma.InputJsonValue,
        step: AiVideoStep.ASSETS,
      },
    });
  }

  async updateEnhancements(clientId: string, id: string, dto: UpdateEnhancementsDto) {
    await this.requireInClient(id, clientId);
    return this.prisma.aiVideoProject.update({
      where: { id },
      data: {
        enhancements: dto as unknown as Prisma.InputJsonValue,
        step: AiVideoStep.ENHANCE,
      },
    });
  }

  async render(clientId: string, id: string, actorId: string) {
    const existing = await this.requireInClient(id, clientId);
    const scenes = (existing.scenes as unknown as ScriptScene[] | null) ?? [];
    const subject = existing.idea || existing.title;
    const prompt = [
      `A vibrant, high-production-value social media video thumbnail concept for: ${subject}.`,
      scenes[0] ? `Opening scene: ${scenes[0].description}.` : null,
      'Eye-catching, professional photography style, no text or logos overlaid.',
    ]
      .filter((line): line is string => !!line)
      .join(' ');

    const imageBuffer = await this.foundry.generateImage(prompt);
    const filename = `${randomUUID()}.png`;
    await writeFile(join(UPLOAD_DIR, filename), imageBuffer);
    const previewUrl = `/uploads/${filename}`;

    const project = await this.prisma.aiVideoProject.update({
      where: { id },
      data: { previewUrl, step: AiVideoStep.PREVIEW },
    });
    await this.audit.log({
      userId: actorId,
      action: 'AI_VIDEO_RENDERED',
      entityType: 'ai_video_project',
      entityId: id,
      // The preview image itself is real AI-generated content now — "simulated" still applies
      // to the overall feature (this produces one still image, not an actual rendered video).
      metadata: { simulated: true },
    });
    return project;
  }

  async export(clientId: string, id: string, actorId: string, dto: ExportVideoDto) {
    await this.requireInClient(id, clientId);
    const project = await this.prisma.aiVideoProject.update({
      where: { id },
      data: { exportFormat: dto.format, step: AiVideoStep.EXPORT },
    });
    await this.audit.log({
      userId: actorId,
      action: 'AI_VIDEO_EXPORTED',
      entityType: 'ai_video_project',
      entityId: id,
      metadata: { format: dto.format, simulated: true },
    });
    return project;
  }

  async publish(clientId: string, id: string, actorId: string) {
    await this.requireInClient(id, clientId);
    const project = await this.prisma.aiVideoProject.update({
      where: { id },
      data: { publishedAt: new Date(), step: AiVideoStep.PUBLISHED },
    });
    await this.audit.log({
      userId: actorId,
      action: 'AI_VIDEO_PUBLISHED',
      entityType: 'ai_video_project',
      entityId: id,
      metadata: { simulated: true },
    });
    return project;
  }

  async remove(clientId: string, id: string, actorId: string) {
    await this.requireInClient(id, clientId);
    await this.prisma.aiVideoProject.delete({ where: { id } });
    await this.audit.log({
      userId: actorId,
      action: 'AI_VIDEO_PROJECT_DELETED',
      entityType: 'ai_video_project',
      entityId: id,
    });
  }

  private async requireInClient(id: string, clientId: string) {
    const project = await this.prisma.aiVideoProject.findUnique({ where: { id } });
    if (!project || project.clientId !== clientId) {
      throw new NotFoundException('Video project not found for this client');
    }
    return project;
  }
}
