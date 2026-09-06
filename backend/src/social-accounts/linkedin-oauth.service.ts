import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decodeOAuthState, encodeOAuthState, type OAuthState } from './oauth-state.js';

interface LinkedInTokenResponse {
  access_token?: string;
  error_description?: string;
}

interface LinkedInUserInfoResponse {
  sub?: string;
  name?: string;
  error_description?: string;
}

@Injectable()
export class LinkedInOAuthService {
  constructor(private config: ConfigService) {}

  private get clientId(): string {
    return this.config.getOrThrow<string>('LINKEDIN_CLIENT_ID');
  }

  private get clientSecret(): string {
    return this.config.getOrThrow<string>('LINKEDIN_CLIENT_SECRET');
  }

  get redirectUri(): string {
    const appUrl = this.config.getOrThrow<string>('PUBLIC_APP_URL');
    return `${appUrl}/api/social-accounts/linkedin/callback`;
  }

  encodeState(state: OAuthState): string {
    return encodeOAuthState(state, this.clientSecret);
  }

  decodeState(encoded: string): OAuthState {
    return decodeOAuthState(encoded, this.clientSecret);
  }

  buildAuthUrl(state: OAuthState): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state: this.encodeState(state),
      scope: 'openid profile email',
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    let res: Response;
    try {
      res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch {
      throw new BadGatewayException('Could not reach LinkedIn. Please try again.');
    }
    const data = (await res.json()) as LinkedInTokenResponse;
    if (!data.access_token) {
      throw new BadGatewayException(data.error_description ?? 'LinkedIn did not return an access token');
    }
    return data.access_token;
  }

  async fetchProfile(accessToken: string): Promise<{ id: string; name: string }> {
    let res: Response;
    try {
      res = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      throw new BadGatewayException('Could not reach LinkedIn. Please try again.');
    }
    const data = (await res.json()) as LinkedInUserInfoResponse;
    if (!data.sub || !data.name) {
      throw new BadGatewayException(data.error_description ?? 'LinkedIn did not return a usable profile');
    }
    return { id: data.sub, name: data.name };
  }
}
