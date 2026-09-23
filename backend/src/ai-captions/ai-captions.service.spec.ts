import { describe, expect, it, vi } from 'vitest';
import { AiCaptionsService } from './ai-captions.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { AzureAiFoundryService } from '../ai-common/azure-ai-foundry.service.js';

function buildService(
  overrides: { caption?: any; foundryReply?: string; brandKit?: any } = {
    caption: { id: 'cap-1', clientId: 'client-1' },
  },
) {
  const caption = overrides.caption;
  const audit = { log: vi.fn() };
  const prisma = {
    aiCaption: {
      findUnique: vi.fn(() => Promise.resolve(caption)),
      delete: vi.fn(() => Promise.resolve({})),
    },
    brandKit: {
      findUnique: vi.fn(() => Promise.resolve(overrides.brandKit ?? null)),
    },
  };
  const foundry = {
    chat: vi.fn(() =>
      Promise.resolve(
        overrides.foundryReply ??
          JSON.stringify([{ text: 'Check out our new product!', hashtags: ['#new', '#launch'] }]),
      ),
    ),
  };
  const service = new AiCaptionsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    foundry as unknown as AzureAiFoundryService,
  );
  return { service, prisma, audit, foundry };
}

describe('AiCaptionsService.generate', () => {
  it('parses a well-formed JSON array response into caption variants', async () => {
    const { service } = buildService();
    const result = await service.generate('client-1', 'actor-1', { input: 'our new product', tone: 'Bold' } as any);
    expect(result).toEqual([{ text: 'Check out our new product!', hashtags: ['#new', '#launch'] }]);
  });

  it('strips a markdown code fence the model wraps the JSON in', async () => {
    const { service } = buildService({
      foundryReply: '```json\n[{"text":"Hi","hashtags":["#a"]}]\n```',
    });
    const result = await service.generate('client-1', 'actor-1', { input: 'x' } as any);
    expect(result).toEqual([{ text: 'Hi', hashtags: ['#a'] }]);
  });

  it('rejects a response that is not valid JSON', async () => {
    const { service } = buildService({ foundryReply: 'Sure, here are some captions: ...' });
    await expect(service.generate('client-1', 'actor-1', { input: 'x' } as any)).rejects.toThrow(
      'could not parse',
    );
  });

  it('rejects a response whose shape does not match caption variants', async () => {
    const { service } = buildService({ foundryReply: JSON.stringify({ not: 'an array' }) });
    await expect(service.generate('client-1', 'actor-1', { input: 'x' } as any)).rejects.toThrow('unexpected response');
  });

  it('defaults to a Friendly tone and passes the platform through to the prompt', async () => {
    const { service, foundry } = buildService();
    await service.generate('client-1', 'actor-1', { input: 'x', platform: 'INSTAGRAM' } as any);
    const [, userMessage] = foundry.chat.mock.calls[0][0];
    expect(userMessage.content).toContain('Friendly');
    expect(userMessage.content).toContain('INSTAGRAM');
  });

  it('audit-logs the generation call itself, not just the later save (AI-2)', async () => {
    const { service, audit } = buildService();
    await service.generate('client-1', 'actor-1', { input: 'x', tone: 'Bold', platform: 'INSTAGRAM' } as any);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'actor-1',
        action: 'AI_CAPTION_GENERATED',
        metadata: expect.objectContaining({ tone: 'Bold', platform: 'INSTAGRAM' }),
      }),
    );
  });

  it('injects the brand kit voice guidelines into the prompt when one exists (FEAT-3)', async () => {
    const { service, foundry, prisma } = buildService({
      brandKit: { voiceGuidelines: 'Always playful, never corporate.', aiContext: null, brandRules: null },
    });
    await service.generate('client-1', 'actor-1', { input: 'x' } as any);

    expect(prisma.brandKit.findUnique).toHaveBeenCalledWith({ where: { clientId: 'client-1' } });
    const [, userMessage] = foundry.chat.mock.calls[0][0];
    expect(userMessage.content).toContain('Always playful, never corporate.');
  });

  it('includes brand rules and AI context alongside voice guidelines', async () => {
    const { service, foundry } = buildService({
      brandKit: {
        voiceGuidelines: 'Warm and direct.',
        aiContext: 'We sell eco-friendly kitchenware.',
        brandRules: { neverUse: ['cheap', 'discount'] },
      },
    });
    await service.generate('client-1', 'actor-1', { input: 'x' } as any);

    const [, userMessage] = foundry.chat.mock.calls[0][0];
    expect(userMessage.content).toContain('Warm and direct.');
    expect(userMessage.content).toContain('eco-friendly kitchenware');
    expect(userMessage.content).toContain('cheap');
  });

  it('says nothing about brand voice when no brand kit exists for the client', async () => {
    const { service, foundry } = buildService({ brandKit: null });
    await service.generate('client-1', 'actor-1', { input: 'x' } as any);

    const [, userMessage] = foundry.chat.mock.calls[0][0];
    expect(userMessage.content).not.toContain('brand voice');
  });
});

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
