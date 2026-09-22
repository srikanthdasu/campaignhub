import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlobServiceClient, BlobSASPermissions } from '@azure/storage-blob';
import { UPLOAD_DIR } from './media-storage.js';

const CONTAINER_NAME = 'media';
const DEFAULT_EXPIRY_MINUTES = 60;

// Azure App Service's local disk is not durable — files written there can be lost on a
// restart, scale event, or slot swap. Blob Storage is the real production destination; local
// disk stays as a fallback so local dev keeps working without an Azure Storage account.
@Injectable()
export class BlobStorageService {
  private client: BlobServiceClient | null;

  constructor(private config: ConfigService) {
    const connectionString = config.get<string>('AZURE_STORAGE_CONNECTION_STRING');
    this.client = connectionString ? BlobServiceClient.fromConnectionString(connectionString) : null;
  }

  async upload(buffer: Buffer, extension: string, contentType: string): Promise<string> {
    const blobName = `${randomUUID()}${extension}`;

    if (!this.client) {
      await writeFile(join(UPLOAD_DIR, blobName), buffer);
      return `/uploads/${blobName}`;
    }

    const containerClient = this.client.getContainerClient(CONTAINER_NAME);
    // No `access` option — private by default. A stored storageUrl is a bare blob URL with no
    // credential attached, so a private container means that URL alone can no longer read
    // anything; getReadUrl() below is what actually authorizes access, on demand, per request.
    await containerClient.createIfNotExists();
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(buffer, { blobHTTPHeaders: { blobContentType: contentType } });
    return blockBlobClient.url;
  }

  /**
   * Turns a stored (bare, unauthenticated) storageUrl into a short-lived URL a browser can
   * actually load — an Azure SAS query string for the Blob path, or a signed token for the
   * local-disk dev fallback (see verifyLocalToken, used by the guarded /media-files route this
   * pairs with in create-app.ts). Every response path that returns a MediaAsset to the frontend
   * must call this before sending storageUrl out, or the container-privacy change above just
   * turns "readable by anyone" into "readable by no one."
   */
  async getReadUrl(storageUrl: string, expiryMinutes = DEFAULT_EXPIRY_MINUTES): Promise<string> {
    const blobName = storageUrl.split('/').pop();
    if (!blobName) return storageUrl;

    if (!this.client) {
      const { token, expires } = this.signLocalToken(blobName, expiryMinutes);
      return `/media-files/${blobName}?token=${token}&expires=${expires}`;
    }

    const blockBlobClient = this.client.getContainerClient(CONTAINER_NAME).getBlockBlobClient(blobName);
    return blockBlobClient.generateSasUrl({
      permissions: BlobSASPermissions.parse('r'),
      expiresOn: new Date(Date.now() + expiryMinutes * 60 * 1000),
    });
  }

  /**
   * Local-disk equivalent of an Azure SAS token: an HMAC over {blobName, expiry}, so
   * /media-files (create-app.ts) can verify a request is both unforged and not expired without
   * needing an Authorization header — a plain <img src> load never sends one. Signed with the
   * same secret already required and validated for OAuth token encryption; reusing it avoids a
   * new required env var for what is purely a dev-only fallback (production always has real
   * Blob Storage configured, so this path never runs there).
   */
  private signLocalToken(blobName: string, expiryMinutes: number): { token: string; expires: string } {
    const expires = String(Date.now() + expiryMinutes * 60 * 1000);
    const token = this.hmac(blobName, expires);
    return { token, expires };
  }

  verifyLocalToken(blobName: string, token: string, expires: string): boolean {
    if (Number(expires) < Date.now()) return false;
    const expected = Buffer.from(this.hmac(blobName, expires));
    const actual = Buffer.from(token);
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  }

  private hmac(blobName: string, expires: string): string {
    const secret = this.config.getOrThrow<string>('TOKEN_ENCRYPTION_KEY');
    return createHmac('sha256', secret).update(`${blobName}|${expires}`).digest('hex');
  }

  async remove(storageUrl: string): Promise<void> {
    const blobName = storageUrl.split('/').pop();
    if (!blobName) return;

    if (!this.client) {
      try {
        await unlink(join(UPLOAD_DIR, blobName));
      } catch {
        // best-effort — an already-missing file on disk shouldn't block deleting the record
      }
      return;
    }

    try {
      await this.client.getContainerClient(CONTAINER_NAME).getBlockBlobClient(blobName).deleteIfExists();
    } catch {
      // best-effort — same reasoning as the local-disk path above
    }
  }
}
