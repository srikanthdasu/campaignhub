import { Module } from '@nestjs/common';
import { InboxService } from './inbox.service.js';
import { InboxController } from './inbox.controller.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [InboxController],
  providers: [InboxService],
})
export class InboxModule {}
