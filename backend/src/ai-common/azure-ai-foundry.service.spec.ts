import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AzureAiFoundryService } from './azure-ai-foundry.service.js';
import type { ConfigService } from '@nestjs/config';

const CONFIG_VALUES: Record<string, string> = {
  AZURE_AI_FOUNDRY_ENDPOINT: 'https://example-foundry.services.ai.azure.com/openai/v1/chat/completions',
  AZURE_AI_FOUNDRY_KEY: 'test-key',
  AZURE_AI_FOUNDRY_TEXT_MODEL: 'Test-Model',
};

function buildService() {
  const config = { getOrThrow: vi.fn((key: string) => CONFIG_VALUES[key]) };
  const service = new AzureAiFoundryService(config as unknown as ConfigService);
  return { service, config };
}

function jsonResponse(status: number, body: unknown, ok = status >= 200 && status < 300) {
  return { ok, status, json: () => Promise.resolve(body) } as Response;
}

describe('AzureAiFoundryService.chat', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts to the configured endpoint with the api-key header and model from config', async () => {
    const { service } = buildService();
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(200, { choices: [{ message: { content: 'hello' } }] })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await service.chat([{ role: 'user', content: 'hi' }]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(CONFIG_VALUES.AZURE_AI_FOUNDRY_ENDPOINT);
    expect((init!.headers as Record<string, string>)['api-key']).toBe('test-key');
    const body = JSON.parse(init!.body as string);
    expect(body.model).toBe('Test-Model');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('defaults max_tokens and temperature when not provided', async () => {
    const { service } = buildService();
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(200, { choices: [{ message: { content: 'hi' } }] })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await service.chat([{ role: 'user', content: 'hi' }]);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init!.body as string);
    expect(body.max_tokens).toBe(600);
    expect(body.temperature).toBe(0.7);
  });

  it('passes through explicit maxTokens/temperature overrides', async () => {
    const { service } = buildService();
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(200, { choices: [{ message: { content: 'hi' } }] })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await service.chat([{ role: 'user', content: 'hi' }], { maxTokens: 100, temperature: 0.2 });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init!.body as string);
    expect(body.max_tokens).toBe(100);
    expect(body.temperature).toBe(0.2);
  });

  it('returns the message content on a successful response', async () => {
    const { service } = buildService();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(200, { choices: [{ message: { content: 'a real reply' } }] }))),
    );

    const result = await service.chat([{ role: 'user', content: 'hi' }]);
    expect(result).toBe('a real reply');
  });

  it('throws BadGatewayException when the network request itself fails', async () => {
    const { service } = buildService();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('ECONNREFUSED'))),
    );

    await expect(service.chat([{ role: 'user', content: 'hi' }])).rejects.toThrow(
      'Could not reach the AI service',
    );
  });

  it('throws BadGatewayException on a non-2xx response, including the status code', async () => {
    const { service } = buildService();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(500, {}))));

    await expect(service.chat([{ role: 'user', content: 'hi' }])).rejects.toThrow('failed (500)');
  });

  it('throws BadGatewayException when the response has no message content', async () => {
    const { service } = buildService();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, { choices: [] }))));

    await expect(service.chat([{ role: 'user', content: 'hi' }])).rejects.toThrow('empty response');
  });

  it('throws BadGatewayException when the message content is blank', async () => {
    const { service } = buildService();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(200, { choices: [{ message: { content: '   ' } }] }))),
    );

    await expect(service.chat([{ role: 'user', content: 'hi' }])).rejects.toThrow('empty response');
  });
});
