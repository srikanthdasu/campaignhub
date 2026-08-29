import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { simulateVideoScenes, simulateVideoScript } from '../ai-common/simulated-ai.js';
import { CreateVideoProjectDto } from './dto/create-video-project.dto.js';
import { GenerateScriptDto } from './dto/generate-script.dto.js';
import { UpdateStoryboardDto } from './dto/update-storyboard.dto.js';
import { UpdateAssetsDto } from './dto/update-assets.dto.js';
import { UpdateEnhancementsDto } from './dto/update-enhancements.dto.js';
import { ExportVideoDto } from './dto/export-video.dto.js';
import { AiVideoStep } from '../generated/prisma/client.js';
import type { Prisma } from '../generated/prisma/client.js';

// No Google Cloud / Vertex AI credentials are configured (spec itself notes the Veo provider
// choice is undecided pending GCP credit confirmation), so "render" and "export" produce a
// placeholder thumbnail instead of a real video file. Every other step (script, storyboard,
// asset selection, enhancements) is fully functional against the same data shape a real
// pipeline would use.
const PLACEHOLDER_PREVIEW_URL = '/brand/emblem.png';

@Injectable()
export class AiVideoStudioService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
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
    const script = simulateVideoScript(dto.idea);
    const scenes = simulateVideoScenes(dto.idea) as unknown as Prisma.InputJsonValue;
    return this.prisma.aiVideoProject.update({
      where: { id },
      data: { idea: dto.idea, script, scenes, step: AiVideoStep.SCRIPT },
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
    await this.requireInClient(id, clientId);
    const project = await this.prisma.aiVideoProject.update({
      where: { id },
      data: { previewUrl: PLACEHOLDER_PREVIEW_URL, step: AiVideoStep.PREVIEW },
    });
    await this.audit.log({
      userId: actorId,
      action: 'AI_VIDEO_RENDERED',
      entityType: 'ai_video_project',
      entityId: id,
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
