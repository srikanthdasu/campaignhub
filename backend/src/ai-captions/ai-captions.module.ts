import { Module } from '@nestjs/common';
import { AiCaptionsService } from './ai-captions.service.js';
import { AiCaptionsController } from './ai-captions.controller.js';
import { AuditModule } from '../audit/audit.module.js';
import { AiCommonModule } from '../ai-common/ai-common.module.js';

@Module({
  imports: [AuditModule, AiCommonModule],
  controllers: [AiCaptionsController],
  providers: [AiCaptionsService],
})
export class AiCaptionsModule {}
