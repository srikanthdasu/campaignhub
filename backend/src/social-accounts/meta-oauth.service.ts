import { createHmac, timingSafeEqual } from 'crypto';
import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface OAuthState {
  clientId: string;
  actorId: string;
}

interface MetaTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: { message?: string };
}

interface MetaProfileResponse {
  id?: string;
  name?: string;
  email?: string;
  error?: { message?: string };
}

@Injectable()
export class MetaOAuthService {
  constructor(private config: ConfigService) {}

  private get appId(): string {
    return this.config.getOrThrow<string>('FACEBOOK_APP_ID');
  }

  private get appSecret(): string {
    return this.config.getOrThrow<string>('FACEBOOK_APP_SECRET');
  }

  get redirectUri(): string {
    const appUrl = this.config.getOrThrow<string>('PUBLIC_APP_URL');
    return `${appUrl}/api/social-accounts/facebook/callback`;
  }

  /**
   * The redirect back from Facebook carries no auth cookie/header of ours, so it can't be
   * guarded the normal way — the state param is how the callback knows which client/user
   * initiated the connection. HMAC-signing it (same approach as RazorpayService's payment
   * signature) stops a forged state from attaching a hijacked OAuth code to a client the
   * requester doesn't actually have access to.
   */
  encodeState(state: OAuthState): string {
    const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
    const signature = createHmac('sha256', this.appSecret).update(payload).digest('base64url');
    return `${payload}.${signature}`;
  }

  decodeState(encoded: string): OAuthState {
    const [payload, signature] = encoded.split('.');
    if (!payload || !signature) throw new BadRequestException('Invalid OAuth state');

    const expected = createHmac('sha256', this.appSecret).update(payload).digest('base64url');
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(signature);
    if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
      throw new BadRequestException('Invalid OAuth state');
    }

    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OAuthState;
  }

  buildAuthUrl(state: OAuthState): string {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      state: this.encodeState(state),
      scope: 'email,public_profile',
      response_type: 'code',
    });
    return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: this.redirectUri,
      code,
    });

    const shortLived = await this.fetchJson<MetaTokenResponse>(
      `${GRAPH_BASE}/oauth/access_token?${params.toString()}`,
    );
    if (!shortLived.access_token) {
      throw new BadGatewayException(shortLived.error?.message ?? 'Facebook did not return an access token');
    }

    // Meta issues short-lived tokens (~1-2h) from the code exchange — exchanging for the
    // long-lived variant (~60 days) is what makes the connection actually useful past login.
    const longLivedParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: shortLived.access_token,
    });
    const longLived = await this.fetchJson<MetaTokenResponse>(
      `${GRAPH_BASE}/oauth/access_token?${longLivedParams.toString()}`,
    );

    return longLived.access_token ?? shortLived.access_token;
  }

  async fetchProfile(accessToken: string): Promise<{ id: string; name: string; email: string | null }> {
    const params = new URLSearchParams({ fields: 'id,name,email', access_token: accessToken });
    const profile = await this.fetchJson<MetaProfileResponse>(`${GRAPH_BASE}/me?${params.toString()}`);
    if (!profile.id || !profile.name) {
      throw new BadGatewayException(profile.error?.message ?? 'Facebook did not return a usable profile');
    }
    return { id: profile.id, name: profile.name, email: profile.email ?? null };
  }

  private async fetchJson<T>(url: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      throw new BadGatewayException('Could not reach Facebook. Please try again.');
    }
    return (await res.json()) as T;
  }
}
