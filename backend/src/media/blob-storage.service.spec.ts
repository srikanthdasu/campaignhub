import { describe, expect, it, vi, afterAll } from 'vitest';
import { readFile, rm } from 'fs/promises';
import { join } from 'path';

vi.mock('./media-storage.js', async () => {
  const { mkdtempSync } = await import('fs');
  const { tmpdir: tmp } = await import('os');
  const { join: j } = await import('path');
  return { UPLOAD_DIR: mkdtempSync(j(tmp(), 'blob-storage-test-')) };
});

import { BlobStorageService } from './blob-storage.service.js';
import { UPLOAD_DIR } from './media-storage.js';
import type { ConfigService } from '@nestjs/config';

function buildService(connectionString: string | undefined = undefined) {
  const config = { get: vi.fn(() => connectionString) };
  return new BlobStorageService(config as unknown as ConfigService);
}

describe('BlobStorageService (no Azure Storage configured — local dev fallback)', () => {
  afterAll(async () => {
    await rm(UPLOAD_DIR, { recursive: true, force: true }).catch(() => {});
  });

  it('writes the buffer to local disk and returns an /uploads URL', async () => {
    const service = buildService();
    const url = await service.upload(Buffer.from('hello'), '.png', 'image/png');

    expect(url).toMatch(/^\/uploads\/.+\.png$/);
    const fileName = url.split('/').pop()!;
    const written = await readFile(join(UPLOAD_DIR, fileName));
    expect(written.toString()).toBe('hello');
  });

  it('removes the file that a previously returned URL points at', async () => {
    const service = buildService();
    const url = await service.upload(Buffer.from('bye'), '.png', 'image/png');
    const fileName = url.split('/').pop()!;

    await service.remove(url);

    await expect(readFile(join(UPLOAD_DIR, fileName))).rejects.toThrow();
  });

  it('does not throw when removing a URL whose file is already gone', async () => {
    const service = buildService();
    await expect(service.remove('/uploads/never-existed.png')).resolves.toBeUndefined();
  });
});
