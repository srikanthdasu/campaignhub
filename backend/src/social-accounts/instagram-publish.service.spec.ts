import { afterEach, describe, expect, it, vi } from 'vitest';
import { InstagramPublishService, InstagramPublishError } from './instagram-publish.service.js';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('InstagramPublishService.publishImage', () => {
  it('creates a media container then publishes it, returning the published media id', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve({ id: 'container-1' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ id: 'media-1' }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new InstagramPublishService();
    const mediaId = await service.publishImage('ig-user-1', 'token-1', 'https://example.com/pic.jpg', 'hello');

    expect(mediaId).toBe('media-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/ig-user-1/media');
    expect(fetchMock.mock.calls[1][0]).toContain('/ig-user-1/media_publish');
  });

  it('throws when Instagram rejects the container creation', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve({ error: { message: 'Invalid image URL' } }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new InstagramPublishService();
    await expect(
      service.publishImage('ig-user-1', 'token-1', 'https://example.com/pic.jpg', 'hello'),
    ).rejects.toThrow(InstagramPublishError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when Instagram rejects the publish step', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve({ id: 'container-1' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ error: { message: 'Rate limited' } }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new InstagramPublishService();
    await expect(
      service.publishImage('ig-user-1', 'token-1', 'https://example.com/pic.jpg', 'hello'),
    ).rejects.toThrow('Rate limited');
  });
});
