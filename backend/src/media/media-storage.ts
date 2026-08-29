import { randomUUID } from 'crypto';
import { extname } from 'path';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import { MediaType } from '../generated/prisma/client.js';

// Local-disk storage for Phase 2 dev. The spec calls for Azure Blob Storage in production —
// swapping the multer storage engine and MediaAsset.storageUrl scheme is the only change needed
// once that's wired up; nothing else in this module assumes a local path.
export const UPLOAD_DIR = './uploads';

export const mediaMulterStorage = diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    cb(null, `${randomUUID()}${extname(file.originalname)}`);
  },
});

const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/'];
const ALLOWED_DOCUMENT_MIMES = new Set(['application/pdf']);
// Never allow HTML/SVG or script-bearing types through, even though they'd otherwise
// match an "image/" or generic prefix — both can carry executable script and are served
// back from the API's own origin.
const BLOCKED_MIMES = new Set(['image/svg+xml', 'text/html', 'application/xhtml+xml']);

export function mediaMulterFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  const mimetype = file.mimetype.toLowerCase();
  if (BLOCKED_MIMES.has(mimetype)) {
    cb(new Error(`File type "${mimetype}" is not allowed`), false);
    return;
  }
  const allowed =
    ALLOWED_MIME_PREFIXES.some((prefix) => mimetype.startsWith(prefix)) ||
    ALLOWED_DOCUMENT_MIMES.has(mimetype);
  if (!allowed) {
    cb(new Error(`File type "${mimetype}" is not allowed`), false);
    return;
  }
  cb(null, true);
}

export function mediaTypeFromMimetype(mimetype: string): MediaType {
  if (mimetype === 'image/gif') return MediaType.GIF;
  if (mimetype.startsWith('image/')) return MediaType.IMAGE;
  if (mimetype.startsWith('video/')) return MediaType.VIDEO;
  if (mimetype.startsWith('audio/')) return MediaType.AUDIO;
  return MediaType.DOCUMENT;
}
