import { Module } from '@nestjs/common';
import { ApprovalsService } from './approvals.service.js';
import { ApprovalsController } from './approvals.controller.js';
import { AuditModule } from '../audit/audit.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { MediaModule } from '../media/media.module.js';

@Module({
  imports: [AuditModule, NotificationsModule, MediaModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
