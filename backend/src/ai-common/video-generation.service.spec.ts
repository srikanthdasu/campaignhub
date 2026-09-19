import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoGenerationService } from './video-generation.service.js';
import type { ConfigService } from '@nestjs/config';

const CONFIG_VALUES: Record<string, string | undefined> = {
  VIDEO_EXPORT_ENABLED: 'true',
  MAGIC_HOUR_API_KEY: 'test-magic-hour-key',
  MAGIC_HOUR_MODEL: undefined,
  MAGIC_HOUR_RESOLUTION: undefined,
  MAGIC_HOUR_AUDIO: undefined,
};

function buildService(configOverrides: Record<string, string | undefined> = {}) {
  const values = { ...CONFIG_VALUES, ...configOverrides };
  const config = {
    getOrThrow: vi.fn((key: string) => values[key]),
    get: vi.fn((key: string) => values[key]),
  };
  const service = new VideoGenerationService(config as unknown as ConfigService);
  return { service, config };
}

function jsonResponse(status: number, body: unknown, ok = status >= 200 && status < 300) {
  return { ok, status, json: () => Promise.resolve(body) } as Response;
}

function binaryResponse(status: number, bytes: Uint8Array, ok = status >= 200 && status < 300) {
  return { ok, status, arrayBuffer: () => Promise.resolve(bytes.buffer) } as Response;
}

describe('VideoGenerationService.generateVideo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const VIDEO_BYTES = new Uint8Array([1, 2, 3, 4]);

  it('creates a project, polls until complete, and downloads the resulting video bytes', async () => {
    const { service } = buildService();
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { id: 'proj-1', credits_charged: 450 }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'rendering' }))
      .mockResolvedValueOnce(
        jsonResponse(200, { status: 'complete', downloads: [{ url: 'https://cdn.magichour.ai/proj-1.mp4' }] }),
      )
      .mockResolvedValueOnce(binaryResponse(200, VIDEO_BYTES));
    vi.stubGlobal('fetch', fetchMock);

    const promise = service.generateVideo('a vibrant product video', 8);
    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result).toEqual(Buffer.from(VIDEO_BYTES));

    const [createUrl, createInit] = fetchMock.mock.calls[0];
    expect(createUrl).toBe('https://api.magichour.ai/v1/text-to-video');
    expect((createInit!.headers as Record<string, string>)['Authorization']).toBe('Bearer test-magic-hour-key');
    const createBody = JSON.parse(createInit!.body as string);
    expect(createBody).toEqual({
      style: { prompt: 'a vibrant product video' },
      end_seconds: 8,
      resolution: '480p',
      aspect_ratio: '9:16',
      audio: false,
    });

    const [pollUrl] = fetchMock.mock.calls[1];
    expect(pollUrl).toBe('https://api.magichour.ai/v1/video-projects/proj-1');

    const [downloadUrl, downloadInit] = fetchMock.mock.calls[3];
    expect(downloadUrl).toBe('https://cdn.magichour.ai/proj-1.mp4');
    expect(downloadInit).toBeUndefined();
  });

  it('includes model and uses an upgraded resolution when MAGIC_HOUR_MODEL/_RESOLUTION are set', async () => {
    const { service } = buildService({ MAGIC_HOUR_MODEL: 'kling-3.0', MAGIC_HOUR_RESOLUTION: '1080p' });
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { id: 'proj-1' }))
      .mockResolvedValueOnce(
        jsonResponse(200, { status: 'complete', downloads: [{ url: 'https://cdn.magichour.ai/proj-1.mp4' }] }),
      )
      .mockResolvedValueOnce(binaryResponse(200, VIDEO_BYTES));
    vi.stubGlobal('fetch', fetchMock);

    const promise = service.generateVideo('idea', 8);
    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    const [, createInit] = fetchMock.mock.calls[0];
    const createBody = JSON.parse(createInit!.body as string);
    expect(createBody).toEqual({
      style: { prompt: 'idea' },
      end_seconds: 8,
      model: 'kling-3.0',
      resolution: '1080p',
      aspect_ratio: '9:16',
      audio: false,
    });
  });

  it('enables audio only when MAGIC_HOUR_AUDIO is explicitly "true"', async () => {
    const { service } = buildService({ MAGIC_HOUR_AUDIO: 'true' });
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { id: 'proj-1' }))
      .mockResolvedValueOnce(
        jsonResponse(200, { status: 'complete', downloads: [{ url: 'https://cdn.magichour.ai/proj-1.mp4' }] }),
      )
      .mockResolvedValueOnce(binaryResponse(200, VIDEO_BYTES));
    vi.stubGlobal('fetch', fetchMock);

    const promise = service.generateVideo('idea', 8);
    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    const [, createInit] = fetchMock.mock.calls[0];
    expect(JSON.parse(createInit!.body as string).audio).toBe(true);
  });

  it('throws ServiceUnavailableException when VIDEO_EXPORT_ENABLED is unset, without calling the API', async () => {
    const { service } = buildService({ VIDEO_EXPORT_ENABLED: undefined });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(service.generateVideo('idea', 5)).rejects.toThrow("isn't available yet");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws ServiceUnavailableException when VIDEO_EXPORT_ENABLED is any value other than "true"', async () => {
    const { service } = buildService({ VIDEO_EXPORT_ENABLED: 'false' });
    await expect(service.generateVideo('idea', 5)).rejects.toThrow("isn't available yet");
  });

  it('throws BadGatewayException when the project errors out', async () => {
    const { service } = buildService();
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { id: 'proj-1' }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'error', error: { message: 'moderation flagged' } }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = service.generateVideo('idea', 5);
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(5000);

    await expect(promise).rejects.toThrow('moderation flagged');
  });

  it('throws BadGatewayException when the network request itself fails', async () => {
    const { service } = buildService();
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('ECONNREFUSED'))));

    await expect(service.generateVideo('idea', 5)).rejects.toThrow('Could not reach the AI video service');
  });

  it('throws BadGatewayException when the create response has no project id', async () => {
    const { service } = buildService();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, {}))));

    await expect(service.generateVideo('idea', 5)).rejects.toThrow('did not return a project id');
  });

  it('throws BadGatewayException on a non-2xx create response', async () => {
    const { service } = buildService();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(402, {}))));

    await expect(service.generateVideo('idea', 5)).rejects.toThrow('failed (402)');
  });
});
