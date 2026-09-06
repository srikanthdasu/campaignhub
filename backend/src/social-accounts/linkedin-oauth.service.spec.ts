import { describe, expect, it, vi } from 'vitest';
import { LinkedInOAuthService } from './linkedin-oauth.service.js';
import type { ConfigService } from '@nestjs/config';

const CONFIG: Record<string, string> = {
  LINKEDIN_CLIENT_ID: 'li-client-id',
  LINKEDIN_CLIENT_SECRET: 'li-client-secret',
  PUBLIC_APP_URL: 'https://app.example.com',
};

function buildService() {
  const config = { getOrThrow: vi.fn((key: string) => CONFIG[key]) };
  return new LinkedInOAuthService(config as unknown as ConfigService);
}

describe('LinkedInOAuthService state signing', () => {
  it('round-trips a valid state', () => {
    const service = buildService();
    const encoded = service.encodeState({ clientId: 'client-1', actorId: 'actor-1' });
    expect(service.decodeState(encoded)).toEqual({ clientId: 'client-1', actorId: 'actor-1' });
  });

  it('rejects a tampered payload', () => {
    const service = buildService();
    const encoded = service.encodeState({ clientId: 'client-1', actorId: 'actor-1' });
    const [, signature] = encoded.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ clientId: 'someone-elses-client', actorId: 'actor-1' })).toString(
      'base64url',
    );
    expect(() => service.decodeState(`${forgedPayload}.${signature}`)).toThrow('Invalid OAuth state');
  });

  it('rejects a malformed state', () => {
    const service = buildService();
    expect(() => service.decodeState('not-a-valid-state')).toThrow('Invalid OAuth state');
  });
});

describe('LinkedInOAuthService.buildAuthUrl', () => {
  it('builds the LinkedIn authorize URL with the signed state and redirect URI', () => {
    const service = buildService();
    const url = new URL(service.buildAuthUrl({ clientId: 'client-1', actorId: 'actor-1' }));

    expect(url.origin + url.pathname).toBe('https://www.linkedin.com/oauth/v2/authorization');
    expect(url.searchParams.get('client_id')).toBe('li-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/api/social-accounts/linkedin/callback');
    expect(url.searchParams.get('scope')).toBe('openid profile email');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(service.decodeState(url.searchParams.get('state')!)).toEqual({ clientId: 'client-1', actorId: 'actor-1' });
  });
});
