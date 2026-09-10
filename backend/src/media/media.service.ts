import { Injectable, NotFoundException } from '@nestjs/common';
import { extname } from 'path';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { UpdateMediaDto } from './dto/update-media.dto.js';
import { mediaTypeFromMimetype } from './media-storage.js';
import { BlobStorageService } from './blob-storage.service.js';
import { AzureAiFoundryService } from '../ai-common/azure-ai-foundry.service.js';
import { MediaType } from '../generated/prisma/client.js';

@Injectable()
export class MediaService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private blobStorage: BlobStorageService,
    private foundry: AzureAiFoundryService,
  ) {}

  async generateImage(
    clientId: string,
    actorId: string,
    prompt: string,
    options: { size?: string; folder?: string; campaignId?: string } = {},
  ) {
    const imageBuffer = await this.foundry.generateImage(prompt, options.size);
    const storageUrl = await this.blobStorage.upload(imageBuffer, '.png', 'image/png');

    const asset = await this.prisma.mediaAsset.create({
      data: {
        clientId,
        campaignId: options.campaignId,
        type: MediaType.IMAGE,
        storageUrl,
        fileName: `${prompt.slice(0, 60).trim() || 'ai-generated'}.png`,
        fileSize: imageBuffer.length,
        folder: options.folder,
        tags: [],
        aiProvider: 'azure-ai-foundry',
        prompt,
        uploadedById: actorId,
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'MEDIA_AI_GENERATED',
      entityType: 'media_asset',
      entityId: asset.id,
      metadata: { prompt },
    });

    return asset;
  }

  async recordUpload(
    clientId: string,
    actorId: string,
    file: Express.Multer.File,
    folder?: string,
    campaignId?: string,
  ) {
    const storageUrl = await this.blobStorage.upload(
      file.buffer,
      extname(file.originalname),
      file.mimetype,
    );

    const asset = await this.prisma.mediaAsset.create({
      data: {
        clientId,
        campaignId,
        type: mediaTypeFromMimetype(file.mimetype),
        storageUrl,
        fileName: file.originalname,
        fileSize: file.size,
        folder,
        tags: [],
        uploadedById: actorId,
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'MEDIA_UPLOADED',
      entityType: 'media_asset',
      entityId: asset.id,
    });

    return asset;
  }

  async list(clientId: string, folder?: string, campaignId?: string) {
    return this.prisma.mediaAsset.findMany({
      where: { clientId, folder, campaignId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, clientId: string, dto: UpdateMediaDto) {
    await this.requireInClient(id, clientId);
    return this.prisma.mediaAsset.update({
      where: { id },
      data: {
        folder: dto.folder,
        tags: dto.tags,
        title: dto.title,
        description: dto.description,
        campaignId: dto.campaignId,
      },
    });
  }

  async bulkRemove(ids: string[], clientId: string, actorId: string) {
    const assets = await this.prisma.mediaAsset.findMany({ where: { id: { in: ids }, clientId } });
    await this.prisma.mediaAsset.deleteMany({ where: { id: { in: assets.map((a) => a.id) } } });
    await Promise.all(assets.map((a) => this.blobStorage.remove(a.storageUrl)));

    await this.audit.log({
      userId: actorId,
      action: 'MEDIA_BULK_DELETED',
      entityType: 'media_asset',
      metadata: { count: assets.length, ids: assets.map((a) => a.id) },
    });

    return assets.length;
  }

  async remove(id: string, clientId: string, actorId: string) {
    const asset = await this.requireInClient(id, clientId);

    await this.prisma.mediaAsset.delete({ where: { id } });
    await this.blobStorage.remove(asset.storageUrl);

    await this.audit.log({
      userId: actorId,
      action: 'MEDIA_DELETED',
      entityType: 'media_asset',
      entityId: id,
    });
  }

  async incrementUsage(id: string) {
    await this.prisma.mediaAsset.update({
      where: { id },
      data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
    });
  }

  private async requireInClient(id: string, clientId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset || asset.clientId !== clientId) {
      throw new NotFoundException('Media asset not found for this client');
    }
    return asset;
  }
}
