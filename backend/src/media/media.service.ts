import { Injectable, NotFoundException } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { UpdateMediaDto } from './dto/update-media.dto.js';
import { mediaTypeFromMimetype, UPLOAD_DIR } from './media-storage.js';

@Injectable()
export class MediaService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async recordUpload(
    clientId: string,
    actorId: string,
    file: Express.Multer.File,
    folder?: string,
  ) {
    const asset = await this.prisma.mediaAsset.create({
      data: {
        clientId,
        type: mediaTypeFromMimetype(file.mimetype),
        storageUrl: `/uploads/${file.filename}`,
        fileName: file.originalname,
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

  async list(clientId: string, folder?: string) {
    return this.prisma.mediaAsset.findMany({
      where: { clientId, folder },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, clientId: string, dto: UpdateMediaDto) {
    await this.requireInClient(id, clientId);
    return this.prisma.mediaAsset.update({
      where: { id },
      data: { folder: dto.folder, tags: dto.tags },
    });
  }

  async remove(id: string, clientId: string, actorId: string) {
    const asset = await this.requireInClient(id, clientId);

    await this.prisma.mediaAsset.delete({ where: { id } });

    try {
      const fileName = asset.storageUrl.split('/').pop();
      if (fileName) await unlink(join(UPLOAD_DIR, fileName));
    } catch {
      // best-effort — an already-missing file on disk shouldn't block deleting the record
    }

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
      data: { usageCount: { increment: 1 } },
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
