import { Module } from '@nestjs/common';
import { ContentService } from './content.service.js';
import { ContentController } from './content.controller.js';
import { AuditModule } from '../audit/audit.module.js';
import { MediaModule } from '../media/media.module.js';
import { ApprovalsModule } from '../approvals/approvals.module.js';

@Module({
  imports: [AuditModule, MediaModule, ApprovalsModule],
  controllers: [ContentController],
  providers: [ContentService],
})
export class ContentModule {}
