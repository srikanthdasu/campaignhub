import { Module } from '@nestjs/common';
import { SocialAccountsService } from './social-accounts.service.js';
import { SocialAccountsController } from './social-accounts.controller.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [SocialAccountsController],
  providers: [SocialAccountsService],
})
export class SocialAccountsModule {}
