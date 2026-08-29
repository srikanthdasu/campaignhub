import { Module } from '@nestjs/common';
import { AiVideoStudioService } from './ai-video-studio.service.js';
import { AiVideoStudioController } from './ai-video-studio.controller.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [AiVideoStudioController],
  providers: [AiVideoStudioService],
})
export class AiVideoStudioModule {}
