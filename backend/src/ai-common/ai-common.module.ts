import { Module } from '@nestjs/common';
import { AzureAiFoundryService } from './azure-ai-foundry.service.js';

@Module({
  providers: [AzureAiFoundryService],
  exports: [AzureAiFoundryService],
})
export class AiCommonModule {}
