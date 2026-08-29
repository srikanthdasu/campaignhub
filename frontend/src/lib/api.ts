const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let accessToken: string | null = null;
let onTokenChange: ((token: string | null) => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  onTokenChange?.(token);
}

export function subscribeToTokenChanges(listener: (token: string | null) => void) {
  onTokenChange = listener;
}

async function parseBody(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  agencyId: string | null;
}

interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

// Deduped so concurrent 401s (e.g. several requests firing on page load) share one
// /auth/refresh call instead of racing — the backend rotates the refresh token on each
// use, so a second concurrent call would otherwise present an already-revoked token and fail.
let refreshInFlight: Promise<AuthResponse | null> | null = null;

function refreshSession(): Promise<AuthResponse | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      setAccessToken(null);
      return null;
    }
    const body = (await parseBody(res)) as AuthResponse;
    setAccessToken(body.accessToken);
    return body;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && !isRetry && path !== '/auth/refresh') {
    const session = await refreshSession();
    if (session) {
      return request<T>(path, options, true);
    }
  }

  const body = await parseBody(res);

  if (!res.ok) {
    const message = (body && (body.message?.toString() ?? body.error)) || res.statusText;
    throw new ApiError(res.status, Array.isArray(message) ? message.join(', ') : message);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  refreshSession,
};
