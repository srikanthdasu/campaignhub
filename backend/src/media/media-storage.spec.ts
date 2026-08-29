import { describe, expect, it, vi } from 'vitest';
import { mediaMulterFileFilter } from './media-storage.js';

function file(mimetype: string) {
  return { mimetype } as Express.Multer.File;
}

describe('mediaMulterFileFilter', () => {
  it.each(['image/png', 'image/jpeg', 'image/gif', 'video/mp4', 'audio/mpeg', 'application/pdf'])(
    'accepts %s',
    (mimetype) => {
      const cb = vi.fn();
      mediaMulterFileFilter({} as any, file(mimetype), cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    },
  );

  it.each(['text/html', 'image/svg+xml', 'application/xhtml+xml'])(
    'rejects script-bearing type %s even though it matches an allowed prefix or is document-like',
    (mimetype) => {
      const cb = vi.fn();
      mediaMulterFileFilter({} as any, file(mimetype), cb);
      expect(cb).toHaveBeenCalledWith(expect.any(Error), false);
    },
  );

  it.each(['application/x-msdownload', 'application/javascript', 'text/plain'])(
    'rejects unlisted type %s',
    (mimetype) => {
      const cb = vi.fn();
      mediaMulterFileFilter({} as any, file(mimetype), cb);
      expect(cb).toHaveBeenCalledWith(expect.any(Error), false);
    },
  );
});
