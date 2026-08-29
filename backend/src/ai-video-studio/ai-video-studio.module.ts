import { Module } from '@nestjs/common';
import { AiVideoStudioService } from './ai-video-studio.service.js';
import { AiVideoStudioController } from './ai-video-studio.controller.js';
import { AuditModule } from '../audit/audit.module.js';
import { AiCommonModule } from '../ai-common/ai-common.module.js';

@Module({
  imports: [AuditModule, AiCommonModule],
  controllers: [AiVideoStudioController],
  providers: [AiVideoStudioService],
})
export class AiVideoStudioModule {}
