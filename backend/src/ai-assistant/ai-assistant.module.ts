import { Module } from '@nestjs/common';
import { AiAssistantService } from './ai-assistant.service.js';
import { AiAssistantController } from './ai-assistant.controller.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [AiAssistantController],
  providers: [AiAssistantService],
})
export class AiAssistantModule {}
