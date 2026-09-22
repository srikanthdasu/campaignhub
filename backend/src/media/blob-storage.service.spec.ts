import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile, rm } from 'fs/promises';
import { join } from 'path';
import type { ConfigService } from '@nestjs/config';

vi.mock('./media-storage.js', async () => {
  const { mkdtempSync } = await import('fs');
  const { tmpdir: tmp } = await import('os');
  const { join: j } = await import('path');
  return { UPLOAD_DIR: mkdtempSync(j(tmp(), 'blob-storage-test-')) };
});

const {
  generateSasUrlMock,
  createIfNotExistsMock,
  uploadDataMock,
  deleteIfExistsMock,
  getBlockBlobClientMock,
  getContainerClientMock,
  fromConnectionStringMock,
} = vi.hoisted(() => {
  const generateSasUrlMock = vi.fn(() => Promise.resolve('https://fake.blob.core.windows.net/media/blob-1.png?sig=abc'));
  const createIfNotExistsMock = vi.fn(() => Promise.resolve());
  const uploadDataMock = vi.fn(() => Promise.resolve());
  const deleteIfExistsMock = vi.fn(() => Promise.resolve());
  const getBlockBlobClientMock = vi.fn((blobName: string) => ({
    url: `https://fake.blob.core.windows.net/media/${blobName}`,
    uploadData: uploadDataMock,
    deleteIfExists: deleteIfExistsMock,
    generateSasUrl: generateSasUrlMock,
  }));
  const getContainerClientMock = vi.fn(() => ({
    createIfNotExists: createIfNotExistsMock,
    getBlockBlobClient: getBlockBlobClientMock,
  }));
  const fromConnectionStringMock = vi.fn(() => ({ getContainerClient: getContainerClientMock }));
  return {
    generateSasUrlMock,
    createIfNotExistsMock,
    uploadDataMock,
    deleteIfExistsMock,
    getBlockBlobClientMock,
    getContainerClientMock,
    fromConnectionStringMock,
  };
});

vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: { fromConnectionString: fromConnectionStringMock },
  BlobSASPermissions: { parse: vi.fn((permissions: string) => permissions) },
}));

const { BlobStorageService } = await import('./blob-storage.service.js');
const { UPLOAD_DIR } = await import('./media-storage.js');

const ENCRYPTION_KEY = 'test-token-encryption-key-1234567890';

function buildService(connectionString?: string) {
  const config = {
    get: vi.fn((key: string) => (key === 'AZURE_STORAGE_CONNECTION_STRING' ? connectionString : undefined)),
    getOrThrow: vi.fn((key: string) => {
      if (key === 'TOKEN_ENCRYPTION_KEY') return ENCRYPTION_KEY;
      throw new Error(`unexpected config key ${key}`);
    }),
  };
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

  it('returns a signed /media-files URL whose token verifies for that exact blob name', async () => {
    const service = buildService();
    const url = await service.getReadUrl('/uploads/blob-1.png');

    expect(url).toMatch(/^\/media-files\/blob-1\.png\?token=.+&expires=\d+$/);

    const params = new URLSearchParams(url.split('?')[1]);
    const token = params.get('token')!;
    const expires = params.get('expires')!;
    expect(service.verifyLocalToken('blob-1.png', token, expires)).toBe(true);
  });

  it('rejects a token minted for a different blob name', async () => {
    const service = buildService();
    const url = await service.getReadUrl('/uploads/blob-1.png');
    const params = new URLSearchParams(url.split('?')[1]);

    expect(service.verifyLocalToken('blob-2.png', params.get('token')!, params.get('expires')!)).toBe(false);
  });

  it('rejects a tampered expires value even if the token string is reused', async () => {
    const service = buildService();
    const url = await service.getReadUrl('/uploads/blob-1.png');
    const params = new URLSearchParams(url.split('?')[1]);
    const pushedOutExpiry = String(Number(params.get('expires')) + 60 * 60 * 1000);

    expect(service.verifyLocalToken('blob-1.png', params.get('token')!, pushedOutExpiry)).toBe(false);
  });

  it('rejects an expired token even with a correctly-signed value', () => {
    const service = buildService();
    const expiredExpires = String(Date.now() - 1000);
    // A real token for this (blobName, expires) pair — verifyLocalToken must still reject it
    // purely because expires is in the past, independent of signature correctness.
    const signed = (service as unknown as { hmac: (b: string, e: string) => string }).hmac(
      'blob-1.png',
      expiredExpires,
    );
    expect(service.verifyLocalToken('blob-1.png', signed, expiredExpires)).toBe(false);
  });

  it('rejects a garbage token of the wrong length rather than throwing', () => {
    const service = buildService();
    const futureExpires = String(Date.now() + 60_000);
    expect(service.verifyLocalToken('blob-1.png', 'not-a-real-token', futureExpires)).toBe(false);
  });
});

describe('BlobStorageService — Azure Blob path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates the container without public access — private by default', async () => {
    const service = buildService('UseDevelopmentStorage=true');
    await service.upload(Buffer.from('img'), '.png', 'image/png');
    expect(createIfNotExistsMock).toHaveBeenCalledWith();
  });

  it('generates a read-only, time-limited SAS URL for a stored blob', async () => {
    const service = buildService('UseDevelopmentStorage=true');
    const url = await service.getReadUrl('https://fake.blob.core.windows.net/media/blob-1.png');

    expect(getBlockBlobClientMock).toHaveBeenCalledWith('blob-1.png');
    expect(generateSasUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({ permissions: 'r', expiresOn: expect.any(Date) }),
    );
    expect(url).toBe('https://fake.blob.core.windows.net/media/blob-1.png?sig=abc');
  });
});
