import { describe, expect, it, vi } from 'vitest';
import { NotificationsService } from './notifications.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function buildService(overrides: { notification?: any } = {}) {
  const notification = overrides.notification ?? { id: 'notif-1', userId: 'user-1', isRead: false };
  const prisma = {
    notification: {
      create: vi.fn((args: any) => Promise.resolve({ id: 'notif-1', ...args.data })),
      createMany: vi.fn(() => Promise.resolve({})),
      findUnique: vi.fn(() => Promise.resolve(notification)),
      update: vi.fn((args: any) => Promise.resolve({ ...notification, ...args.data })),
      updateMany: vi.fn(() => Promise.resolve({})),
    },
  };
  const service = new NotificationsService(prisma as unknown as PrismaService);
  return { service, prisma, notification };
}

describe('NotificationsService', () => {
  it('rejects marking another user\'s notification as read (IDOR guard)', async () => {
    const { service } = buildService({ notification: { id: 'notif-1', userId: 'someone-else', isRead: false } });
    await expect(service.markRead('user-1', 'notif-1')).rejects.toThrow('Notification not found');
  });

  it('marks the owning user\'s own notification as read', async () => {
    const { service, prisma } = buildService();
    await service.markRead('user-1', 'notif-1');
    expect(prisma.notification.update).toHaveBeenCalledWith({ where: { id: 'notif-1' }, data: { isRead: true } });
  });

  it('skips the batch insert when there are no recipients', async () => {
    const { service, prisma } = buildService();
    await service.createMany([], 'hello');
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });
});
