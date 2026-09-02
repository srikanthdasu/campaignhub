import { Controller, Get, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { MetaOAuthService } from './meta-oauth.service.js';
import { SocialAccountsService } from './social-accounts.service.js';
import { SocialPlatform } from '../generated/prisma/client.js';
import { Public } from '../common/decorators/public.decorator.js';

// Deliberately not under clients/:clientId and not behind ClientAccessGuard/RolesGuard — this is
// Facebook's server redirecting the user's browser back to us after they approve (or deny) the
// login dialog, so the request carries no session cookie or Authorization header for us to guard
// on. The signed `state` param (verified inside MetaOAuthService.decodeState) is what proves this
// callback is legitimate and tells us which client/user to attribute the connection to — see
// MetaOAuthService's class comment for why the state has to be signed rather than trusted as-is.
@Controller('social-accounts/facebook')
export class MetaOAuthCallbackController {
  constructor(
    private metaOAuth: MetaOAuthService,
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
      const message = errorDescription || error || 'Facebook login was cancelled or failed';
      return res.redirect(`${returnTo}?connect_error=${encodeURIComponent(message)}`);
    }

    try {
      const { clientId, actorId } = this.metaOAuth.decodeState(state);
      const accessToken = await this.metaOAuth.exchangeCodeForToken(code);
      const profile = await this.metaOAuth.fetchProfile(accessToken);

      await this.socialAccounts.createFromOAuth(
        clientId,
        actorId,
        SocialPlatform.FACEBOOK,
        profile.name,
        profile.id,
        accessToken,
      );

      return res.redirect(`${returnTo}?connected=facebook`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect Facebook account';
      return res.redirect(`${returnTo}?connect_error=${encodeURIComponent(message)}`);
    }
  }
}
