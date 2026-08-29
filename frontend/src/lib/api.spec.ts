import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, setAccessToken, subscribeToTokenChanges } from './api.js';

function jsonResponse(status: number, body: unknown, ok = status >= 200 && status < 300) {
  return {
    ok,
    status,
    statusText: 'status text',
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

describe('api client', () => {
  beforeEach(() => {
    setAccessToken(null);
    subscribeToTokenChanges(() => {});
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('attaches the current access token as a Bearer header', async () => {
    setAccessToken('token-123');
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, { ok: true })));
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/whoami');

    const [, init] = fetchMock.mock.calls[0];
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer token-123');
  });

  it('omits the Authorization header when there is no token', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, {})));
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/public');

    const [, init] = fetchMock.mock.calls[0];
    expect(init!.headers as Record<string, string>).not.toHaveProperty('Authorization');
  });

  it('joins an array of validation error messages into one string', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(400, { message: ['email must be an email', 'password too short'] })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/whatever')).rejects.toMatchObject({
      message: 'email must be an email, password too short',
    });
  });

  it('throws ApiError with the response status on a non-ok response', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(404, { message: 'Not found' })));
    vi.stubGlobal('fetch', fetchMock);

    const error = await api.get('/missing').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
  });

  it('on a 401, silently refreshes once and retries the original request with the new token', async () => {
    setAccessToken('stale-token');
    const fetchMock = vi.fn((url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(jsonResponse(200, { user: { id: 'u1' }, accessToken: 'fresh-token' }));
      }
      const authHeader = (init.headers as Record<string, string>).Authorization;
      if (authHeader === 'Bearer fresh-token') {
        return Promise.resolve(jsonResponse(200, { data: 'ok' }));
      }
      return Promise.resolve(jsonResponse(401, {}));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.get('/protected');

    expect(result).toEqual({ data: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(3); // protected (401) -> refresh -> protected (retry, 200)
  });

  it('does not attempt to refresh when the refresh endpoint itself returns 401 (no infinite loop)', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(401, {})));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.refreshSession()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('dedupes concurrent refresh calls into a single in-flight request', async () => {
    let refreshCalls = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        return Promise.resolve(jsonResponse(200, { user: { id: 'u1' }, accessToken: 'fresh-token' }));
      }
      return Promise.resolve(jsonResponse(200, {}));
    });
    vi.stubGlobal('fetch', fetchMock);

    const [a, b] = await Promise.all([api.refreshSession(), api.refreshSession()]);

    expect(refreshCalls).toBe(1);
    expect(a).toEqual(b);
  });

  it('clears the access token when a refresh attempt fails', async () => {
    setAccessToken('stale-token');
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(401, {})));
    vi.stubGlobal('fetch', fetchMock);

    let sawNullToken = false;
    subscribeToTokenChanges((token) => {
      if (token === null) sawNullToken = true;
    });

    await api.refreshSession();
    expect(sawNullToken).toBe(true);
  });
});
