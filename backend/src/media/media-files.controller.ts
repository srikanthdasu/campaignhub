import { Controller, ForbiddenException, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import { Public } from '../common/decorators/public.decorator.js';
import { BlobStorageService } from './blob-storage.service.js';
import { UPLOAD_DIR } from './media-storage.js';

// Local-dev-only equivalent of an Azure SAS URL (see BlobStorageService.getReadUrl) — replaces
// the unauthenticated app.useStaticAssets('/uploads') this app used to serve local-disk uploads
// with. A plain <img src> request never carries an Authorization header, so this can't use
// JwtAuthGuard; the signed token in the query string is what proves the request is legitimate
// and not expired instead.
@Controller('media-files')
export class MediaFilesController {
  constructor(private blobStorage: BlobStorageService) {}

  @Public()
  @Get(':filename')
  serve(
    @Param('filename') filename: string,
    @Query('token') token: string,
    @Query('expires') expires: string,
    @Res() res: Response,
  ) {
    // blobName is always a flat `${randomUUID()}${extension}` (see BlobStorageService.upload) —
    // reject anything with a path separator before it ever reaches the filesystem join below.
    if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      throw new NotFoundException('File not found');
    }
    if (!token || !expires || !this.blobStorage.verifyLocalToken(filename, token, expires)) {
      throw new ForbiddenException('This link is invalid or has expired');
    }

    const filePath = join(UPLOAD_DIR, filename);
    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    res.sendFile(filePath);
  }
}
