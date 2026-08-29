import { describe, expect, it, vi } from 'vitest';
import { InboxService } from './inbox.service.js';
import { Role } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { sub: 'user-1', email: 'a@b.com', role: Role.MANAGER, agencyId: 'agency-1', ...overrides };
}

function buildService(overrides: { message?: any } = {}) {
  const message = overrides.message ?? { id: 'msg-1', clientId: 'client-1', isRead: false };
  const audit = { log: vi.fn() };
  const prisma = {
    inboxMessage: {
      findUnique: vi.fn(() => Promise.resolve(message)),
      update: vi.fn((args: any) => Promise.resolve({ ...message, ...args.data })),
    },
  };
  const service = new InboxService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  return { service, prisma, audit, message };
}

describe('InboxService', () => {
  it('rejects marking a message from a different client as read', async () => {
    const { service } = buildService({ message: { id: 'msg-1', clientId: 'other-client', isRead: false } });
    await expect(service.markRead('client-1', 'msg-1')).rejects.toThrow(
      'Inbox message not found for this client',
    );
  });

  it('rejects replying to a message from a different client', async () => {
    const { service } = buildService({ message: { id: 'msg-1', clientId: 'other-client', isRead: false } });
    await expect(service.reply('client-1', 'msg-1', makeUser(), 'hi')).rejects.toThrow(
      'Inbox message not found for this client',
    );
  });

  it('marks the message read and audits the reply without claiming platform delivery', async () => {
    const { service, prisma, audit } = buildService();
    await service.reply('client-1', 'msg-1', makeUser(), 'Thanks for reaching out!');
    expect(prisma.inboxMessage.update).toHaveBeenCalledWith({ where: { id: 'msg-1' }, data: { isRead: true } });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { reply: 'Thanks for reaching out!', deliveredToPlatform: false } }),
    );
  });
});
