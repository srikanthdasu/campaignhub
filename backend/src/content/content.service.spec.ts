import { describe, expect, it, vi } from 'vitest';
import { ContentService } from './content.service.js';
import { ContentStatus, Role } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { MediaService } from '../media/media.service.js';
import type { ApprovalsService } from '../approvals/approvals.service.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { sub: 'creator-1', email: 'a@b.com', role: Role.CREATOR, agencyId: 'agency-1', ...overrides };
}

function buildService(overrides: { item?: any } = {}) {
  const item = overrides.item ?? {
    id: 'content-1',
    clientId: 'client-1',
    createdById: 'creator-1',
    status: ContentStatus.DRAFT,
    mediaAssetId: null,
  };
  const audit = { log: vi.fn() };
  const prisma = {
    contentItem: {
      create: vi.fn((args: any) => Promise.resolve({ id: 'content-1', ...args.data })),
      findUnique: vi.fn(() => Promise.resolve(item)),
      update: vi.fn((args: any) => Promise.resolve({ ...item, ...args.data })),
      delete: vi.fn(() => Promise.resolve({})),
    },
  };
  const media = { incrementUsage: vi.fn(() => Promise.resolve()) };
  const approvals = {
    resubmit: vi.fn(() => Promise.resolve({ resubmitted: true })),
    createFlowForContent: vi.fn(() => Promise.resolve({ created: true })),
  };
  const service = new ContentService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    media as unknown as MediaService,
    approvals as unknown as ApprovalsService,
  );
  return { service, prisma, audit, media, approvals, item };
}

describe('ContentService', () => {
  describe('update/remove/submit — client scoping', () => {
    it('rejects an item that belongs to a different client', async () => {
      const { service } = buildService({
        item: { id: 'content-1', clientId: 'other-client', createdById: 'creator-1', status: ContentStatus.DRAFT },
      });
      await expect(
        service.update('client-1', 'content-1', makeUser(), { body: 'x' } as any),
      ).rejects.toThrow('Content item not found for this client');
    });
  });

  describe('assertCanEdit', () => {
    it('lets the creator edit their own draft content', async () => {
      const { service, prisma } = buildService();
      await service.update('client-1', 'content-1', makeUser({ sub: 'creator-1' }), { body: 'updated' } as any);
      expect(prisma.contentItem.update).toHaveBeenCalled();
    });

    it('forbids a different non-agency-wide user from editing someone else\'s content', async () => {
      const { service, prisma } = buildService();
      await expect(
        service.update('client-1', 'content-1', makeUser({ sub: 'other-creator' }), { body: 'x' } as any),
      ).rejects.toThrow('You can only edit content you created');
      expect(prisma.contentItem.update).not.toHaveBeenCalled();
    });

    it('lets a MANAGER edit content created by someone else (agency-wide role)', async () => {
      const { service, prisma } = buildService();
      await service.update('client-1', 'content-1', makeUser({ sub: 'mgr-1', role: Role.MANAGER }), {
        body: 'x',
      } as any);
      expect(prisma.contentItem.update).toHaveBeenCalled();
    });
  });

  describe('status gates', () => {
    it('rejects editing content that is not DRAFT/CHANGES_REQUESTED', async () => {
      const { service } = buildService({
        item: { id: 'content-1', clientId: 'client-1', createdById: 'creator-1', status: ContentStatus.APPROVED },
      });
      await expect(
        service.update('client-1', 'content-1', makeUser(), { body: 'x' } as any),
      ).rejects.toThrow('draft or changes-requested state');
    });

    it('rejects deleting non-draft content', async () => {
      const { service } = buildService({
        item: { id: 'content-1', clientId: 'client-1', createdById: 'creator-1', status: ContentStatus.IN_REVIEW },
      });
      await expect(service.remove('client-1', 'content-1', makeUser())).rejects.toThrow(
        'Only draft content can be deleted',
      );
    });

    it('allows deleting draft content owned by the actor', async () => {
      const { service, prisma } = buildService();
      await service.remove('client-1', 'content-1', makeUser());
      expect(prisma.contentItem.delete).toHaveBeenCalledWith({ where: { id: 'content-1' } });
    });
  });

  describe('submit', () => {
    it('creates a fresh approval flow for draft content', async () => {
      const { service, approvals } = buildService();
      await service.submit('client-1', 'content-1', makeUser(), {
        approverIds: ['a1'],
      } as any);
      expect(approvals.createFlowForContent).toHaveBeenCalledWith('content-1', 'creator-1', ['a1'], undefined, undefined);
    });

    it('resubmits instead of creating a new flow when changes were requested', async () => {
      const { service, approvals } = buildService({
        item: { id: 'content-1', clientId: 'client-1', createdById: 'creator-1', status: ContentStatus.CHANGES_REQUESTED },
      });
      await service.submit('client-1', 'content-1', makeUser(), { approverIds: ['a1'] } as any);
      expect(approvals.resubmit).toHaveBeenCalledWith('content-1', 'creator-1');
      expect(approvals.createFlowForContent).not.toHaveBeenCalled();
    });

    it('rejects submitting content that is already in review', async () => {
      const { service } = buildService({
        item: { id: 'content-1', clientId: 'client-1', createdById: 'creator-1', status: ContentStatus.IN_REVIEW },
      });
      await expect(
        service.submit('client-1', 'content-1', makeUser(), { approverIds: ['a1'] } as any),
      ).rejects.toThrow('Only draft or changes-requested content can be submitted');
    });
  });
});
