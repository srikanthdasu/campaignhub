import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service.js';
import { SchedulerCronService } from './scheduler-cron.service.js';
import { SchedulerController } from './scheduler.controller.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [SchedulerController],
  providers: [SchedulerService, SchedulerCronService],
})
export class SchedulerModule {}
