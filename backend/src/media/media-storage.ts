import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { MediaType } from '../generated/prisma/client.js';

// Resolved from this module's own location rather than process.cwd() — the combined production
// server (combined-server.ts) may be launched with a working directory other than backend/, and
// this has to land in the same physical folder create-app.ts serves /uploads from either way.
// Only actually used as a destination when BlobStorageService falls back to local disk (no
// Azure Storage account configured, i.e. local dev) — see blob-storage.service.ts.
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = join(MODULE_DIR, '..', '..', 'uploads'); // backend/dist/media/../../uploads

// In-memory rather than disk: the file's buffer goes to BlobStorageService.upload(), which
// decides where it actually lands (Blob Storage in production, local disk in dev).
export const mediaMulterStorage = memoryStorage();

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
