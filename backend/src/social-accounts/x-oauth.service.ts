import { createHash, randomBytes } from 'crypto';
import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decodeOAuthState, encodeOAuthState, type OAuthState } from './oauth-state.js';

// X's OAuth 2.0 requires PKCE — a code_verifier generated at buildAuthUrl time that must be
// presented again at token-exchange time. There's no session to stash it in across the redirect,
// so (like clientId/actorId) it rides inside the HMAC-signed state param itself.
interface XOAuthState extends OAuthState {
  codeVerifier: string;
}

interface XTokenResponse {
  access_token?: string;
  error_description?: string;
}

interface XUserResponse {
  data?: { id?: string; name?: string; username?: string };
  errors?: { detail?: string }[];
}

function base64url(input: Buffer): string {
  return input.toString('base64url');
}

@Injectable()
export class XOAuthService {
  constructor(private config: ConfigService) {}

  private get clientId(): string {
    return this.config.getOrThrow<string>('X_CLIENT_ID');
  }

  private get clientSecret(): string {
    return this.config.getOrThrow<string>('X_CLIENT_SECRET');
  }

  get redirectUri(): string {
    const appUrl = this.config.getOrThrow<string>('PUBLIC_APP_URL');
    return `${appUrl}/api/social-accounts/x/callback`;
  }

  decodeState(encoded: string): XOAuthState {
    return decodeOAuthState<XOAuthState>(encoded, this.clientSecret);
  }

  buildAuthUrl(state: OAuthState): string {
    const codeVerifier = base64url(randomBytes(32));
    const codeChallenge = base64url(createHash('sha256').update(codeVerifier).digest());

    const signedState = encodeOAuthState<XOAuthState>({ ...state, codeVerifier }, this.clientSecret);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'tweet.read users.read offline.access',
      state: signedState,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `https://x.com/i/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, codeVerifier: string): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      code_verifier: codeVerifier,
    });
    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    let res: Response;
    try {
      res = await fetch('https://api.x.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
        body,
      });
    } catch {
      throw new BadGatewayException('Could not reach X. Please try again.');
    }
    const data = (await res.json()) as XTokenResponse;
    if (!data.access_token) {
      throw new BadGatewayException(data.error_description ?? 'X did not return an access token');
    }
    return data.access_token;
  }

  async fetchProfile(accessToken: string): Promise<{ id: string; username: string }> {
    let res: Response;
    try {
      res = await fetch('https://api.x.com/2/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      throw new BadGatewayException('Could not reach X. Please try again.');
    }
    const body = (await res.json()) as XUserResponse;
    if (!body.data?.id || !body.data.username) {
      throw new BadGatewayException(body.errors?.[0]?.detail ?? 'X did not return a usable profile');
    }
    return { id: body.data.id, username: body.data.username };
  }
}
