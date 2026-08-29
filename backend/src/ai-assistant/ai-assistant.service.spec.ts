import { describe, expect, it, vi } from 'vitest';
import { AiAssistantService } from './ai-assistant.service.js';
import { AiMessageRole } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { AzureAiFoundryService } from '../ai-common/azure-ai-foundry.service.js';

function buildService(
  overrides: { conversation?: any; priorMessages?: any[]; reply?: string } = {},
) {
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
      findMany: vi.fn(() => Promise.resolve(overrides.priorMessages ?? [])),
      create: vi.fn((args: any) => Promise.resolve({ id: 'msg', ...args.data })),
    },
  };
  const foundry = { chat: vi.fn(() => Promise.resolve(overrides.reply ?? 'Here is my reply.')) };
  const service = new AiAssistantService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    foundry as unknown as AzureAiFoundryService,
  );
  return { service, prisma, audit, foundry, conversation };
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

  it('includes prior conversation history in the model call, mapped to user/assistant roles', async () => {
    const { service, foundry } = buildService({
      priorMessages: [
        { role: AiMessageRole.USER, content: 'first question' },
        { role: AiMessageRole.ASSISTANT, content: 'first answer' },
      ],
    });
    await service.ask('client-1', 'conv-1', 'actor-1', 'follow-up');

    const [messages] = foundry.chat.mock.calls[0];
    expect(messages).toEqual(
      expect.arrayContaining([
        { role: 'user', content: 'first question' },
        { role: 'assistant', content: 'first answer' },
        { role: 'user', content: 'follow-up' },
      ]),
    );
  });

  it('persists the model reply as the assistant message', async () => {
    const { service, prisma } = buildService({ reply: 'Here is a content plan for you.' });
    const { assistantMessage } = await service.ask('client-1', 'conv-1', 'actor-1', 'plan my week');
    expect(assistantMessage.content).toBe('Here is a content plan for you.');
    expect(prisma.aiMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: AiMessageRole.ASSISTANT, content: 'Here is a content plan for you.' }),
      }),
    );
  });
});
