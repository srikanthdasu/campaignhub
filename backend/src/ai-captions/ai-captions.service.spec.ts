import { describe, expect, it, vi } from 'vitest';
import { AiCaptionsService } from './ai-captions.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';

function buildService(overrides: { caption?: any } = { caption: { id: 'cap-1', clientId: 'client-1' } }) {
  const caption = overrides.caption;
  const audit = { log: vi.fn() };
  const prisma = {
    aiCaption: {
      findUnique: vi.fn(() => Promise.resolve(caption)),
      delete: vi.fn(() => Promise.resolve({})),
    },
  };
  const service = new AiCaptionsService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  return { service, prisma, audit };
}

describe('AiCaptionsService.remove', () => {
  it('rejects deleting a caption that belongs to a different client', async () => {
    const { service, prisma } = buildService({ caption: { id: 'cap-1', clientId: 'other-client' } });
    await expect(service.remove('client-1', 'cap-1', 'actor-1')).rejects.toThrow(
      'Caption not found for this client',
    );
    expect(prisma.aiCaption.delete).not.toHaveBeenCalled();
  });

  it('rejects deleting a nonexistent caption', async () => {
    const { service } = buildService({ caption: null });
    await expect(service.remove('client-1', 'missing', 'actor-1')).rejects.toThrow(
      'Caption not found for this client',
    );
  });

  it('allows deleting a caption scoped to the correct client', async () => {
    const { service, prisma } = buildService();
    await service.remove('client-1', 'cap-1', 'actor-1');
    expect(prisma.aiCaption.delete).toHaveBeenCalledWith({ where: { id: 'cap-1' } });
  });
});
