import { Controller, Get, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { InstagramOAuthService } from './instagram-oauth.service.js';
import { SocialAccountsService } from './social-accounts.service.js';
import { SocialPlatform } from '../generated/prisma/client.js';
import { Public } from '../common/decorators/public.decorator.js';

// Same shape as MetaOAuthCallbackController — Instagram's server redirects the user's browser
// back here after they approve (or deny) the login dialog, so there's no session cookie or
// Authorization header on this request to guard on. The signed `state` param is what proves the
// callback is legitimate; see MetaOAuthCallbackController / oauth-state.ts for the full reasoning.
@Controller('social-accounts/instagram')
export class InstagramOAuthCallbackController {
  constructor(
    private instagramOAuth: InstagramOAuthService,
    private socialAccounts: SocialAccountsService,
    private config: ConfigService,
  ) {}

  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: Response,
  ) {
    const appUrl = this.config.getOrThrow<string>('PUBLIC_APP_URL');
    const returnTo = `${appUrl}/social-accounts`;

    if (error || !code || !state) {
      const message = errorDescription || error || 'Instagram login was cancelled or failed';
      return res.redirect(`${returnTo}?connect_error=${encodeURIComponent(message)}`);
    }

    try {
      const { clientId, actorId } = this.instagramOAuth.decodeState(state);
      const accessToken = await this.instagramOAuth.exchangeCodeForToken(code);
      const profile = await this.instagramOAuth.fetchProfile(accessToken);

      await this.socialAccounts.createFromOAuth(
        clientId,
        actorId,
        SocialPlatform.INSTAGRAM,
        profile.username,
        profile.id,
        accessToken,
      );

      return res.redirect(`${returnTo}?connected=instagram`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect Instagram account';
      return res.redirect(`${returnTo}?connect_error=${encodeURIComponent(message)}`);
    }
  }
}
