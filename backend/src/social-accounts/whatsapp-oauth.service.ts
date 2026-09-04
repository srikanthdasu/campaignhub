import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GRAPH_VERSION = 'v21.0';

interface WhatsAppTokenResponse {
  access_token?: string;
  error?: { message?: string };
}

@Injectable()
export class WhatsAppOAuthService {
  constructor(private config: ConfigService) {}

  private get appId(): string {
    return this.config.getOrThrow<string>('WHATSAPP_APP_ID');
  }

  private get appSecret(): string {
    return this.config.getOrThrow<string>('WHATSAPP_APP_SECRET');
  }

  // Embedded Signup hands back its authorization code inside a JS SDK popup callback rather than
  // a page redirect, so there's no redirect_uri here (and no CSRF state to sign — the whole
  // exchange happens on our own already-authenticated page, unlike the Facebook/Instagram
  // connectors whose callback is a bare, unauthenticated redirect from the platform's server).
  async exchangeCodeForToken(code: string): Promise<string> {
    const params = new URLSearchParams({ client_id: this.appId, client_secret: this.appSecret, code });

    let res: Response;
    try {
      res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?${params.toString()}`);
    } catch {
      throw new BadGatewayException('Could not reach WhatsApp. Please try again.');
    }
    const data = (await res.json()) as WhatsAppTokenResponse;
    if (!data.access_token) {
      throw new BadGatewayException(data.error?.message ?? 'WhatsApp did not return an access token');
    }
    return data.access_token;
  }
}
