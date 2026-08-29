import { Module } from '@nestjs/common';
import { AgenciesService } from './agencies.service.js';
import { AgenciesController } from './agencies.controller.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [AgenciesController],
  providers: [AgenciesService],
})
export class AgenciesModule {}
