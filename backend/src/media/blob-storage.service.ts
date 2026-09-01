import { randomUUID } from 'crypto';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlobServiceClient } from '@azure/storage-blob';
import { UPLOAD_DIR } from './media-storage.js';

const CONTAINER_NAME = 'media';

// Azure App Service's local disk is not durable — files written there can be lost on a
// restart, scale event, or slot swap. Blob Storage is the real production destination; local
// disk stays as a fallback so local dev keeps working without an Azure Storage account.
@Injectable()
export class BlobStorageService {
  private client: BlobServiceClient | null;

  constructor(config: ConfigService) {
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
    await containerClient.createIfNotExists({ access: 'blob' });
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(buffer, { blobHTTPHeaders: { blobContentType: contentType } });
    return blockBlobClient.url;
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
