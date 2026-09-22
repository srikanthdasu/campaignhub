import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipeBuilder,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { MediaService } from './media.service.js';
import { UpdateMediaDto } from './dto/update-media.dto.js';
import { GenerateImageDto } from './dto/generate-image.dto.js';
import { mediaMulterStorage, mediaMulterFileFilter } from './media-storage.js';
import { ClientAccessGuard } from '../common/guards/client-access.guard.js';
import { ClientContentCreationGuard } from '../common/guards/client-content-creation.guard.js';
import { AiSpendCapGuard } from '../common/guards/ai-spend-cap.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { AI_GENERATION_THROTTLE } from '../common/rate-limits.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
// Upload/generate stay open to CLIENT (gated separately by ClientContentCreationGuard, matching
// every other content-creation route) — editing/deleting is agency-staff-only, since deletion is
// irreversible (the blob is actually removed) and nothing here tracks per-creator ownership the
// way content.service.ts does, unlike deleting one's own draft content.
const CAN_CREATE = [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.CREATOR, Role.DESIGNER, Role.CLIENT];
const CAN_MANAGE = [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.CREATOR, Role.DESIGNER];

@Controller('clients/:clientId/media')
@UseGuards(ClientAccessGuard, RolesGuard)
export class MediaController {
  constructor(private mediaService: MediaService) {}

  @Post()
  @UseGuards(ClientContentCreationGuard)
  @Roles(...CAN_CREATE)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: mediaMulterStorage,
      fileFilter: mediaMulterFileFilter,
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  upload(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_FILE_SIZE_BYTES })
        .build(),
    )
    file: Express.Multer.File,
    @Body('folder') folder?: string,
    @Body('campaignId') campaignId?: string,
  ) {
    return this.mediaService.recordUpload(clientId, user.sub, file, folder, campaignId);
  }

  @Throttle(AI_GENERATION_THROTTLE)
  @UseGuards(ClientContentCreationGuard, AiSpendCapGuard)
  @Post('generate-image')
  @Roles(...CAN_CREATE)
  generateImage(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateImageDto,
  ) {
    return this.mediaService.generateImage(clientId, user.sub, dto.prompt, {
      size: dto.size,
      folder: dto.folder,
      campaignId: dto.campaignId,
    });
  }

  @Get()
  list(
    @Param('clientId') clientId: string,
    @Query('folder') folder?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.mediaService.list(clientId, folder, campaignId);
  }

  @Patch(':id')
  @Roles(...CAN_MANAGE)
  update(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMediaDto,
  ) {
    return this.mediaService.update(id, clientId, dto);
  }

  @Delete(':id')
  @Roles(...CAN_MANAGE)
  remove(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mediaService.remove(id, clientId, user.sub);
  }

  @Post('bulk-delete')
  @Roles(...CAN_MANAGE)
  bulkRemove(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('ids') ids: string[],
  ) {
    return this.mediaService.bulkRemove(ids, clientId, user.sub);
  }
}
