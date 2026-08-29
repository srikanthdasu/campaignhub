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
import { MediaService } from './media.service.js';
import { UpdateMediaDto } from './dto/update-media.dto.js';
import { mediaMulterStorage, mediaMulterFileFilter } from './media-storage.js';
import { ClientAccessGuard } from '../common/guards/client-access.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

@Controller('clients/:clientId/media')
@UseGuards(ClientAccessGuard)
export class MediaController {
  constructor(private mediaService: MediaService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', { storage: mediaMulterStorage, fileFilter: mediaMulterFileFilter }),
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
  ) {
    return this.mediaService.recordUpload(clientId, user.sub, file, folder);
  }

  @Get()
  list(@Param('clientId') clientId: string, @Query('folder') folder?: string) {
    return this.mediaService.list(clientId, folder);
  }

  @Patch(':id')
  update(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMediaDto,
  ) {
    return this.mediaService.update(id, clientId, dto);
  }

  @Delete(':id')
  remove(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mediaService.remove(id, clientId, user.sub);
  }
}
