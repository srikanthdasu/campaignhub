import { describe, expect, it, vi } from 'vitest';
import { NotificationsService } from './notifications.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { EmailService } from './email.service.js';

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
    user: {
      findUnique: vi.fn((args: any) => Promise.resolve({ email: `${args.where.id}@example.com` })),
    },
  };
  const email = { send: vi.fn(() => Promise.resolve()) };
  const service = new NotificationsService(prisma as unknown as PrismaService, email as unknown as EmailService);
  return { service, prisma, email, notification };
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
    const { service, prisma, email } = buildService();
    await service.createMany([], 'hello');
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('also emails the recipient when creating a single notification', async () => {
    const { service, email } = buildService();
    await service.create('user-1', 'Your post failed to publish');
    expect(email.send).toHaveBeenCalledWith('user-1@example.com', expect.any(String), 'Your post failed to publish');
  });

  it('emails every recipient in a batch notification', async () => {
    const { service, email } = buildService();
    await service.createMany(['user-1', 'user-2'], 'Approval requested');
    expect(email.send).toHaveBeenCalledTimes(2);
    expect(email.send).toHaveBeenCalledWith('user-1@example.com', expect.any(String), 'Approval requested');
    expect(email.send).toHaveBeenCalledWith('user-2@example.com', expect.any(String), 'Approval requested');
  });
});
