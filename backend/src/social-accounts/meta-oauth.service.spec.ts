import { describe, expect, it, vi } from 'vitest';
import { MetaOAuthService } from './meta-oauth.service.js';
import type { ConfigService } from '@nestjs/config';

function buildService() {
  const values: Record<string, string> = {
    FACEBOOK_APP_ID: 'app-id-123',
    FACEBOOK_APP_SECRET: 'app-secret-abc',
    PUBLIC_APP_URL: 'https://campaignhub.example.com',
  };
  const config = { get: vi.fn((k: string) => values[k]), getOrThrow: vi.fn((k: string) => values[k]) };
  return new MetaOAuthService(config as unknown as ConfigService);
}

describe('MetaOAuthService state signing', () => {
  it('round-trips a state it signed itself', () => {
    const service = buildService();
    const encoded = service.encodeState({ clientId: 'client-1', actorId: 'user-1' });
    expect(service.decodeState(encoded)).toEqual({ clientId: 'client-1', actorId: 'user-1' });
  });

  it('rejects a state with a tampered payload', () => {
    const service = buildService();
    const encoded = service.encodeState({ clientId: 'client-1', actorId: 'user-1' });
    const [, signature] = encoded.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ clientId: 'someone-elses-client', actorId: 'user-1' })).toString(
      'base64url',
    );
    expect(() => service.decodeState(`${forgedPayload}.${signature}`)).toThrow('Invalid OAuth state');
  });

  it('rejects a state with a missing or malformed signature', () => {
    const service = buildService();
    expect(() => service.decodeState('not-a-real-state')).toThrow('Invalid OAuth state');
  });
});

describe('MetaOAuthService.buildAuthUrl', () => {
  it('points at the registered redirect URI and includes a signed state', () => {
    const service = buildService();
    const url = service.buildAuthUrl({ clientId: 'client-1', actorId: 'user-1' });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'https://campaignhub.example.com/api/social-accounts/facebook/callback',
    );
    expect(parsed.searchParams.get('client_id')).toBe('app-id-123');
    expect(service.decodeState(parsed.searchParams.get('state')!)).toEqual({
      clientId: 'client-1',
      actorId: 'user-1',
    });
  });
});
