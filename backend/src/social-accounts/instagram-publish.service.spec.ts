import { afterEach, describe, expect, it, vi } from 'vitest';
import { InstagramPublishService, InstagramPublishError } from './instagram-publish.service.js';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('InstagramPublishService.publishImage', () => {
  it('creates a container, waits for it to finish processing, then publishes it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve({ id: 'container-1' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status_code: 'FINISHED' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ id: 'media-1' }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new InstagramPublishService();
    const mediaId = await service.publishImage('ig-user-1', 'token-1', 'https://example.com/pic.jpg', 'hello');

    expect(mediaId).toBe('media-1');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toContain('/ig-user-1/media');
    expect(fetchMock.mock.calls[1][0]).toContain('/container-1');
    expect(fetchMock.mock.calls[2][0]).toContain('/ig-user-1/media_publish');
  });

  it('polls until the container finishes processing before publishing', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve({ id: 'container-1' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status_code: 'IN_PROGRESS' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status_code: 'FINISHED' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ id: 'media-1' }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new InstagramPublishService();
    const resultPromise = service.publishImage('ig-user-1', 'token-1', 'https://example.com/pic.jpg', 'hello');
    await vi.runAllTimersAsync();

    expect(await resultPromise).toBe('media-1');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('throws when the container ends in an error status', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve({ id: 'container-1' }) })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ status_code: 'ERROR', error: { message: 'Aspect ratio not supported' } }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new InstagramPublishService();
    await expect(
      service.publishImage('ig-user-1', 'token-1', 'https://example.com/pic.jpg', 'hello'),
    ).rejects.toThrow('Aspect ratio not supported');
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
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status_code: 'FINISHED' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ error: { message: 'Rate limited' } }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new InstagramPublishService();
    await expect(
      service.publishImage('ig-user-1', 'token-1', 'https://example.com/pic.jpg', 'hello'),
    ).rejects.toThrow('Rate limited');
  });
});

// P1-6: reconnect guidance for an expired/invalid Instagram connection — Meta's documented
// signature for this is error.code === 190 with error.type === 'OAuthException'
// (https://developers.facebook.com/docs/graph-api/guides/error-handling), which previously
// surfaced to users as-is: raw, technical, and silent about reconnecting being the fix.
describe('InstagramPublishService — expired/invalid connection (P1-6)', () => {
  const RECONNECT_MESSAGE = /reconnect the account from social accounts/i;
  const realMetaExpiredTokenError = {
    message: 'Error validating access token: Session has expired on Monday, 05-Oct-26 00:00:00 PDT.',
    type: 'OAuthException',
    code: 190,
  };

  it('replaces a raw expired-token error at the container-creation step with clear reconnect guidance', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ json: () => Promise.resolve({ error: realMetaExpiredTokenError }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new InstagramPublishService();
    await expect(
      service.publishImage('ig-user-1', 'secret-token-value', 'https://example.com/pic.jpg', 'hello'),
    ).rejects.toThrow(RECONNECT_MESSAGE);
  });

  it('replaces a raw expired-token error at the container-status step with clear reconnect guidance', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve({ id: 'container-1' }) })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ status_code: 'ERROR', error: realMetaExpiredTokenError }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new InstagramPublishService();
    await expect(
      service.publishImage('ig-user-1', 'secret-token-value', 'https://example.com/pic.jpg', 'hello'),
    ).rejects.toThrow(RECONNECT_MESSAGE);
  });

  it('replaces a raw expired-token error at the publish step with clear reconnect guidance', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve({ id: 'container-1' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status_code: 'FINISHED' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ error: realMetaExpiredTokenError }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new InstagramPublishService();
    await expect(
      service.publishImage('ig-user-1', 'secret-token-value', 'https://example.com/pic.jpg', 'hello'),
    ).rejects.toThrow(RECONNECT_MESSAGE);
  });

  it('also detects an expired-token error from the message text alone, when code/type are absent', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ error: { message: 'Invalid OAuth access token - Cannot parse access token' } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new InstagramPublishService();
    await expect(
      service.publishImage('ig-user-1', 'secret-token-value', 'https://example.com/pic.jpg', 'hello'),
    ).rejects.toThrow(RECONNECT_MESSAGE);
  });

  it('never includes the access token value in the thrown error message', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ json: () => Promise.resolve({ error: realMetaExpiredTokenError }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new InstagramPublishService();
    await expect(
      service.publishImage('ig-user-1', 'super-secret-token-value', 'https://example.com/pic.jpg', 'hello'),
    ).rejects.not.toThrow(/super-secret-token-value/);
  });

  it('leaves unrelated errors (not an OAuth/token problem) completely unaffected', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve({ error: { message: 'Rate limited', code: 4 } }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new InstagramPublishService();
    await expect(
      service.publishImage('ig-user-1', 'token-1', 'https://example.com/pic.jpg', 'hello'),
    ).rejects.toThrow('Rate limited');
  });
});
