import { describe, expect, it, vi } from 'vitest';
import { AiAssistantService } from './ai-assistant.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';

function buildService(overrides: { conversation?: any } = {}) {
  const conversation = overrides.conversation ?? {
    id: 'conv-1',
    clientId: 'client-1',
    title: 'New conversation',
  };
  const audit = { log: vi.fn() };
  const prisma = {
    aiConversation: {
      findUnique: vi.fn(() => Promise.resolve(conversation)),
      update: vi.fn((args: any) => Promise.resolve({ ...conversation, ...args.data })),
      delete: vi.fn(() => Promise.resolve({})),
    },
    aiMessage: {
      create: vi.fn((args: any) => Promise.resolve({ id: 'msg', ...args.data })),
    },
  };
  const service = new AiAssistantService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  return { service, prisma, audit, conversation };
}

describe('AiAssistantService', () => {
  it('rejects asking in a conversation from a different client', async () => {
    const { service } = buildService({ conversation: { id: 'conv-1', clientId: 'other-client', title: 'x' } });
    await expect(service.ask('client-1', 'conv-1', 'actor-1', 'hi')).rejects.toThrow(
      'Conversation not found for this client',
    );
  });

  it('titles the conversation from the first message only', async () => {
    const { service, prisma } = buildService();
    await service.ask('client-1', 'conv-1', 'actor-1', 'What should our Q1 strategy be?');
    expect(prisma.aiConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: 'What should our Q1 strategy be?' }) }),
    );
  });

  it('does not overwrite the title on later messages', async () => {
    const { service, prisma } = buildService({
      conversation: { id: 'conv-1', clientId: 'client-1', title: 'Already titled' },
    });
    await service.ask('client-1', 'conv-1', 'actor-1', 'Follow-up question');
    expect(prisma.aiConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: undefined }) }),
    );
  });
});
