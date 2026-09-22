import { Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { AuditController } from './audit.controller.js';
import { AuditCronService } from './audit-cron.service.js';

@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditCronService],
  exports: [AuditService],
})
export class AuditModule {}
