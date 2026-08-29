import { randomUUID } from 'crypto';
import { extname } from 'path';
import { diskStorage } from 'multer';
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

export function mediaTypeFromMimetype(mimetype: string): MediaType {
  if (mimetype === 'image/gif') return MediaType.GIF;
  if (mimetype.startsWith('image/')) return MediaType.IMAGE;
  if (mimetype.startsWith('video/')) return MediaType.VIDEO;
  if (mimetype.startsWith('audio/')) return MediaType.AUDIO;
  return MediaType.DOCUMENT;
}
