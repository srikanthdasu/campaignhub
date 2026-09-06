import { Controller, Get, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { XOAuthService } from './x-oauth.service.js';
import { SocialAccountsService } from './social-accounts.service.js';
import { SocialPlatform } from '../generated/prisma/client.js';
import { Public } from '../common/decorators/public.decorator.js';

// Same shape as the other social OAuth callbacks — X's server redirects the user's browser back
// here after they approve (or deny) the login dialog, so there's no session cookie/Authorization
// header on this request to guard on. The signed `state` param proves the callback is legitimate
// and also carries the PKCE code_verifier (see XOAuthService for why).
@Controller('social-accounts/x')
export class XOAuthCallbackController {
  constructor(
    private xOAuth: XOAuthService,
    private socialAccounts: SocialAccountsService,
    private config: ConfigService,
  ) {}

  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const appUrl = this.config.getOrThrow<string>('PUBLIC_APP_URL');
    const returnTo = `${appUrl}/social-accounts`;

    if (error || !code || !state) {
      const message = error || 'X login was cancelled or failed';
      return res.redirect(`${returnTo}?connect_error=${encodeURIComponent(message)}`);
    }

    try {
      const { clientId, actorId, codeVerifier } = this.xOAuth.decodeState(state);
      const accessToken = await this.xOAuth.exchangeCodeForToken(code, codeVerifier);
      const profile = await this.xOAuth.fetchProfile(accessToken);

      await this.socialAccounts.createFromOAuth(
        clientId,
        actorId,
        SocialPlatform.X,
        `@${profile.username}`,
        profile.id,
        accessToken,
      );

      return res.redirect(`${returnTo}?connected=x`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect X account';
      return res.redirect(`${returnTo}?connect_error=${encodeURIComponent(message)}`);
    }
  }
}
