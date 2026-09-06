import { describe, expect, it, vi } from 'vitest';
import { XOAuthService } from './x-oauth.service.js';
import type { ConfigService } from '@nestjs/config';

const CONFIG: Record<string, string> = {
  X_CLIENT_ID: 'x-client-id',
  X_CLIENT_SECRET: 'x-client-secret',
  PUBLIC_APP_URL: 'https://app.example.com',
};

function buildService() {
  const config = { getOrThrow: vi.fn((key: string) => CONFIG[key]) };
  return new XOAuthService(config as unknown as ConfigService);
}

describe('XOAuthService.buildAuthUrl', () => {
  it('builds the x.com authorize URL with PKCE params, signed state, and redirect URI', () => {
    const service = buildService();
    const url = new URL(service.buildAuthUrl({ clientId: 'client-1', actorId: 'actor-1' }));

    expect(url.origin + url.pathname).toBe('https://x.com/i/oauth2/authorize');
    expect(url.searchParams.get('client_id')).toBe('x-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/api/social-accounts/x/callback');
    expect(url.searchParams.get('scope')).toBe('tweet.read users.read offline.access');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();

    const decoded = service.decodeState(url.searchParams.get('state')!);
    expect(decoded).toMatchObject({ clientId: 'client-1', actorId: 'actor-1' });
    expect(decoded.codeVerifier).toBeTruthy();
  });

  it('generates a different code_verifier/challenge on every call', () => {
    const service = buildService();
    const url1 = new URL(service.buildAuthUrl({ clientId: 'client-1', actorId: 'actor-1' }));
    const url2 = new URL(service.buildAuthUrl({ clientId: 'client-1', actorId: 'actor-1' }));
    expect(url1.searchParams.get('code_challenge')).not.toBe(url2.searchParams.get('code_challenge'));
  });

  it('rejects a tampered state', () => {
    const service = buildService();
    const url = new URL(service.buildAuthUrl({ clientId: 'client-1', actorId: 'actor-1' }));
    const [, signature] = url.searchParams.get('state')!.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ clientId: 'someone-elses-client', actorId: 'actor-1', codeVerifier: 'x' }),
    ).toString('base64url');
    expect(() => service.decodeState(`${forgedPayload}.${signature}`)).toThrow('Invalid OAuth state');
  });
});
