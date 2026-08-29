import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service.js';
import { ClientsController } from './clients.controller.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
