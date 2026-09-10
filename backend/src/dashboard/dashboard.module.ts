import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import { DashboardController } from './dashboard.controller.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
