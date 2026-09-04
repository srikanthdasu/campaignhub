import { Module } from '@nestjs/common';
import { SocialAccountsService } from './social-accounts.service.js';
import { SocialAccountsController } from './social-accounts.controller.js';
import { MetaOAuthCallbackController } from './meta-oauth-callback.controller.js';
import { MetaOAuthService } from './meta-oauth.service.js';
import { InstagramOAuthCallbackController } from './instagram-oauth-callback.controller.js';
import { InstagramOAuthService } from './instagram-oauth.service.js';
import { WhatsAppOAuthService } from './whatsapp-oauth.service.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [SocialAccountsController, MetaOAuthCallbackController, InstagramOAuthCallbackController],
  providers: [SocialAccountsService, MetaOAuthService, InstagramOAuthService, WhatsAppOAuthService],
})
export class SocialAccountsModule {}
