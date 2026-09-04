import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decodeOAuthState, encodeOAuthState, type OAuthState } from './oauth-state.js';

interface InstagramShortLivedTokenResponse {
  access_token?: string;
  user_id?: string;
  error_message?: string;
}

interface InstagramLongLivedTokenResponse {
  access_token?: string;
  error?: { message?: string };
}

interface InstagramProfileResponse {
  id?: string;
  username?: string;
  error?: { message?: string };
}

@Injectable()
export class InstagramOAuthService {
  constructor(private config: ConfigService) {}

  private get appId(): string {
    return this.config.getOrThrow<string>('INSTAGRAM_APP_ID');
  }

  private get appSecret(): string {
    return this.config.getOrThrow<string>('INSTAGRAM_APP_SECRET');
  }

  get redirectUri(): string {
    const appUrl = this.config.getOrThrow<string>('PUBLIC_APP_URL');
    return `${appUrl}/api/social-accounts/instagram/callback`;
  }

  encodeState(state: OAuthState): string {
    return encodeOAuthState(state, this.appSecret);
  }

  decodeState(encoded: string): OAuthState {
    return decodeOAuthState(encoded, this.appSecret);
  }

  buildAuthUrl(state: OAuthState): string {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      state: this.encodeState(state),
      scope: 'instagram_business_basic',
      response_type: 'code',
    });
    return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
      code,
    });

    let res: Response;
    try {
      res = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body });
    } catch {
      throw new BadGatewayException('Could not reach Instagram. Please try again.');
    }
    const shortLived = (await res.json()) as InstagramShortLivedTokenResponse;
    if (!shortLived.access_token) {
      throw new BadGatewayException(shortLived.error_message ?? 'Instagram did not return an access token');
    }

    // The code exchange only returns a short-lived token (~1h) — exchanging for the long-lived
    // variant (~60 days) is what makes the connection actually useful past login, same as Facebook.
    const longLivedParams = new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: this.appSecret,
      access_token: shortLived.access_token,
    });
    const longLived = await this.fetchJson<InstagramLongLivedTokenResponse>(
      `https://graph.instagram.com/access_token?${longLivedParams.toString()}`,
    );

    return longLived.access_token ?? shortLived.access_token;
  }

  async fetchProfile(accessToken: string): Promise<{ id: string; username: string }> {
    const params = new URLSearchParams({ fields: 'id,username', access_token: accessToken });
    const profile = await this.fetchJson<InstagramProfileResponse>(
      `https://graph.instagram.com/v21.0/me?${params.toString()}`,
    );
    if (!profile.id || !profile.username) {
      throw new BadGatewayException(profile.error?.message ?? 'Instagram did not return a usable profile');
    }
    return { id: profile.id, username: profile.username };
  }

  private async fetchJson<T>(url: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      throw new BadGatewayException('Could not reach Instagram. Please try again.');
    }
    return (await res.json()) as T;
  }
}
