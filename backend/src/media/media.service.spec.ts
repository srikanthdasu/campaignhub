import { describe, expect, it, vi } from 'vitest';
import { MediaService } from './media.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { BlobStorageService } from './blob-storage.service.js';

function buildService(overrides: { asset?: any } = {}) {
  const asset = overrides.asset ?? { id: 'asset-1', clientId: 'client-1', storageUrl: '/uploads/x.png' };
  const audit = { log: vi.fn() };
  const prisma = {
    mediaAsset: {
      findUnique: vi.fn(() => Promise.resolve(asset)),
      update: vi.fn((args: any) => Promise.resolve({ ...asset, ...args.data })),
      delete: vi.fn(() => Promise.resolve({})),
    },
  };
  const blobStorage = { upload: vi.fn(() => Promise.resolve('/uploads/new.png')), remove: vi.fn(() => Promise.resolve()) };
  const service = new MediaService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    blobStorage as unknown as BlobStorageService,
  );
  return { service, prisma, audit, asset, blobStorage };
}

describe('MediaService', () => {
  it('rejects updating an asset that belongs to a different client', async () => {
    const { service } = buildService({ asset: { id: 'asset-1', clientId: 'other-client' } });
    await expect(service.update('asset-1', 'client-1', { folder: 'x' } as any)).rejects.toThrow(
      'Media asset not found for this client',
    );
  });

  it('rejects removing an asset that belongs to a different client', async () => {
    const { service, prisma } = buildService({ asset: { id: 'asset-1', clientId: 'other-client' } });
    await expect(service.remove('asset-1', 'client-1', 'actor-1')).rejects.toThrow(
      'Media asset not found for this client',
    );
    expect(prisma.mediaAsset.delete).not.toHaveBeenCalled();
  });

  it('allows updating an asset scoped to the correct client', async () => {
    const { service, prisma } = buildService();
    await service.update('asset-1', 'client-1', { folder: 'campaign-x' } as any);
    expect(prisma.mediaAsset.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'asset-1' } }),
    );
  });
});
