import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service.js';
import { ClientsController } from './clients.controller.js';
import { ClientsCronService } from './clients-cron.service.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [ClientsController],
  providers: [ClientsService, ClientsCronService],
})
export class ClientsModule {}
