import { Controller, Get, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { YouTubeOAuthService } from './youtube-oauth.service.js';
import { SocialAccountsService } from './social-accounts.service.js';
import { SocialPlatform } from '../generated/prisma/client.js';
import { Public } from '../common/decorators/public.decorator.js';

// Same shape as the other social OAuth callbacks — Google's server redirects the user's browser
// back here after they approve (or deny) the consent screen, so there's no session cookie/
// Authorization header on this request to guard on. The signed `state` param proves it's legitimate.
@Controller('social-accounts/youtube')
export class YouTubeOAuthCallbackController {
  constructor(
    private youTubeOAuth: YouTubeOAuthService,
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
      const message = error || 'YouTube login was cancelled or failed';
      return res.redirect(`${returnTo}?connect_error=${encodeURIComponent(message)}`);
    }

    try {
      const { clientId, actorId } = this.youTubeOAuth.decodeState(state);
      const accessToken = await this.youTubeOAuth.exchangeCodeForToken(code);
      const channel = await this.youTubeOAuth.fetchChannel(accessToken);

      await this.socialAccounts.createFromOAuth(
        clientId,
        actorId,
        SocialPlatform.YOUTUBE,
        channel.title,
        channel.id,
        accessToken,
      );

      return res.redirect(`${returnTo}?connected=youtube`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect YouTube account';
      return res.redirect(`${returnTo}?connect_error=${encodeURIComponent(message)}`);
    }
  }
}
