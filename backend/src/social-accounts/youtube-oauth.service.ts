import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decodeOAuthState, encodeOAuthState, type OAuthState } from './oauth-state.js';

interface GoogleTokenResponse {
  access_token?: string;
  error_description?: string;
  error?: string;
}

interface YouTubeChannelResponse {
  items?: { id?: string; snippet?: { title?: string } }[];
  error?: { message?: string };
}

@Injectable()
export class YouTubeOAuthService {
  constructor(private config: ConfigService) {}

  private get clientId(): string {
    return this.config.getOrThrow<string>('YOUTUBE_CLIENT_ID');
  }

  private get clientSecret(): string {
    return this.config.getOrThrow<string>('YOUTUBE_CLIENT_SECRET');
  }

  get redirectUri(): string {
    const appUrl = this.config.getOrThrow<string>('PUBLIC_APP_URL');
    return `${appUrl}/api/social-accounts/youtube/callback`;
  }

  encodeState(state: OAuthState): string {
    return encodeOAuthState(state, this.clientSecret);
  }

  decodeState(encoded: string): OAuthState {
    return decodeOAuthState(encoded, this.clientSecret);
  }

  buildAuthUrl(state: OAuthState): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/youtube.readonly',
      state: this.encodeState(state),
      access_type: 'offline',
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });

    let res: Response;
    try {
      res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch {
      throw new BadGatewayException('Could not reach Google. Please try again.');
    }
    const data = (await res.json()) as GoogleTokenResponse;
    if (!data.access_token) {
      throw new BadGatewayException(data.error_description ?? data.error ?? 'Google did not return an access token');
    }
    return data.access_token;
  }

  async fetchChannel(accessToken: string): Promise<{ id: string; title: string }> {
    const params = new URLSearchParams({ part: 'snippet', mine: 'true' });

    let res: Response;
    try {
      res = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      throw new BadGatewayException('Could not reach YouTube. Please try again.');
    }
    const data = (await res.json()) as YouTubeChannelResponse;
    const channel = data.items?.[0];
    if (!channel?.id || !channel.snippet?.title) {
      throw new BadGatewayException(data.error?.message ?? 'YouTube did not return a usable channel');
    }
    return { id: channel.id, title: channel.snippet.title };
  }
}
