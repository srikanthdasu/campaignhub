import { describe, expect, it, vi } from 'vitest';
import { InstagramOAuthService } from './instagram-oauth.service.js';
import type { ConfigService } from '@nestjs/config';

const CONFIG: Record<string, string> = {
  INSTAGRAM_APP_ID: 'ig-app-id',
  INSTAGRAM_APP_SECRET: 'ig-app-secret',
  PUBLIC_APP_URL: 'https://app.example.com',
};

function buildService() {
  const config = { getOrThrow: vi.fn((key: string) => CONFIG[key]) };
  return new InstagramOAuthService(config as unknown as ConfigService);
}

describe('InstagramOAuthService state signing', () => {
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

describe('InstagramOAuthService.buildAuthUrl', () => {
  it('builds the instagram.com authorize URL with the signed state and redirect URI', () => {
    const service = buildService();
    const url = new URL(service.buildAuthUrl({ clientId: 'client-1', actorId: 'actor-1' }));

    expect(url.origin + url.pathname).toBe('https://www.instagram.com/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('ig-app-id');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/api/social-accounts/instagram/callback');
    expect(url.searchParams.get('scope')).toBe('instagram_business_basic');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(service.decodeState(url.searchParams.get('state')!)).toEqual({ clientId: 'client-1', actorId: 'actor-1' });
  });
});
