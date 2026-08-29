import { Module } from '@nestjs/common';
import { AiCaptionsService } from './ai-captions.service.js';
import { AiCaptionsController } from './ai-captions.controller.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [AiCaptionsController],
  providers: [AiCaptionsService],
})
export class AiCaptionsModule {}
