import { Module } from '@nestjs/common';
import { SocialAccountsService } from './social-accounts.service.js';
import { SocialAccountsController } from './social-accounts.controller.js';
import { MetaOAuthCallbackController } from './meta-oauth-callback.controller.js';
import { MetaOAuthService } from './meta-oauth.service.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [SocialAccountsController, MetaOAuthCallbackController],
  providers: [SocialAccountsService, MetaOAuthService],
})
export class SocialAccountsModule {}
