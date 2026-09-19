import { Module } from '@nestjs/common';
import { AzureAiFoundryService } from './azure-ai-foundry.service.js';
import { VideoGenerationService } from './video-generation.service.js';

@Module({
  providers: [AzureAiFoundryService, VideoGenerationService],
  exports: [AzureAiFoundryService, VideoGenerationService],
})
export class AiCommonModule {}
