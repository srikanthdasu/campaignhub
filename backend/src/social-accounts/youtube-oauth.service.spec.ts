import { describe, expect, it, vi } from 'vitest';
import { YouTubeOAuthService } from './youtube-oauth.service.js';
import type { ConfigService } from '@nestjs/config';

const CONFIG: Record<string, string> = {
  YOUTUBE_CLIENT_ID: 'yt-client-id',
  YOUTUBE_CLIENT_SECRET: 'yt-client-secret',
  PUBLIC_APP_URL: 'https://app.example.com',
};

function buildService() {
  const config = { getOrThrow: vi.fn((key: string) => CONFIG[key]) };
  return new YouTubeOAuthService(config as unknown as ConfigService);
}

describe('YouTubeOAuthService state signing', () => {
  it('round-trips a valid state', () => {
    const service = buildService();
    const encoded = service.encodeState({ clientId: 'client-1', actorId: 'actor-1' });
    expect(service.decodeState(encoded)).toEqual({ clientId: 'client-1', actorId: 'actor-1' });
  });

  it('rejects a malformed state', () => {
    const service = buildService();
    expect(() => service.decodeState('not-a-valid-state')).toThrow('Invalid OAuth state');
  });
});

describe('YouTubeOAuthService.buildAuthUrl', () => {
  it('builds the Google authorize URL with the signed state and redirect URI', () => {
    const service = buildService();
    const url = new URL(service.buildAuthUrl({ clientId: 'client-1', actorId: 'actor-1' }));

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('yt-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/api/social-accounts/youtube/callback');
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/youtube.readonly');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(service.decodeState(url.searchParams.get('state')!)).toEqual({ clientId: 'client-1', actorId: 'actor-1' });
  });
});
