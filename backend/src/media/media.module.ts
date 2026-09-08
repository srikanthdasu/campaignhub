import { Module } from '@nestjs/common';
import { MediaService } from './media.service.js';
import { MediaController } from './media.controller.js';
import { BlobStorageService } from './blob-storage.service.js';
import { AuditModule } from '../audit/audit.module.js';
import { AiCommonModule } from '../ai-common/ai-common.module.js';

@Module({
  imports: [AuditModule, AiCommonModule],
  controllers: [MediaController],
  providers: [MediaService, BlobStorageService],
  exports: [MediaService, BlobStorageService],
})
export class MediaModule {}
