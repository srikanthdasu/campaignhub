import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SocialAccountsService } from './social-accounts.service.js';
import { MetaOAuthService } from './meta-oauth.service.js';
import { InstagramOAuthService } from './instagram-oauth.service.js';
import { WhatsAppOAuthService } from './whatsapp-oauth.service.js';
import { CreateSocialAccountDto } from './dto/create-social-account.dto.js';
import { ConnectWhatsAppDto } from './dto/connect-whatsapp.dto.js';
import { ClientAccessGuard } from '../common/guards/client-access.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role, SocialPlatform } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const CAN_MANAGE = [Role.OWNER, Role.ADMIN, Role.MANAGER];

@Controller('clients/:clientId/social-accounts')
@UseGuards(ClientAccessGuard, RolesGuard)
export class SocialAccountsController {
  constructor(
    private socialAccountsService: SocialAccountsService,
    private metaOAuth: MetaOAuthService,
    private instagramOAuth: InstagramOAuthService,
    private whatsAppOAuth: WhatsAppOAuthService,
  ) {}

  @Post()
  @Roles(...CAN_MANAGE)
  create(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSocialAccountDto,
  ) {
    return this.socialAccountsService.create(clientId, user.sub, dto);
  }

  // Returns the URL rather than redirecting directly — the frontend does
  // window.location.href = url, which keeps this a normal authenticated JSON endpoint instead of
  // a redirect response that browsers/fetch clients would follow automatically and unexpectedly.
  @Get('facebook/connect')
  @Roles(...CAN_MANAGE)
  connectFacebook(@Param('clientId') clientId: string, @CurrentUser() user: AuthenticatedUser) {
    const url = this.metaOAuth.buildAuthUrl({ clientId, actorId: user.sub });
    return { url };
  }

  @Get('instagram/connect')
  @Roles(...CAN_MANAGE)
  connectInstagram(@Param('clientId') clientId: string, @CurrentUser() user: AuthenticatedUser) {
    const url = this.instagramOAuth.buildAuthUrl({ clientId, actorId: user.sub });
    return { url };
  }

  // Unlike the Facebook/Instagram connectors, WhatsApp Embedded Signup never leaves this page — the
  // Meta JS SDK popup hands the frontend a code directly, so this is a normal authenticated POST
  // rather than a public redirect-callback route.
  @Post('whatsapp/connect')
  @Roles(...CAN_MANAGE)
  async connectWhatsApp(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConnectWhatsAppDto,
  ) {
    const accessToken = await this.whatsAppOAuth.exchangeCodeForToken(dto.code);
    return this.socialAccountsService.createFromOAuth(
      clientId,
      user.sub,
      SocialPlatform.WHATSAPP,
      `WhatsApp (${dto.phoneNumberId})`,
      dto.phoneNumberId,
      accessToken,
    );
  }

  @Get()
  list(@Param('clientId') clientId: string) {
    return this.socialAccountsService.list(clientId);
  }

  @Delete(':id')
  @Roles(...CAN_MANAGE)
  remove(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.socialAccountsService.remove(clientId, id, user.sub);
  }
}
