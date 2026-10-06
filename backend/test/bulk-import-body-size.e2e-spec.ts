import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createApp } from '../src/create-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { cleanupAgency, createClient, e2eSuffix, registerAndVerify } from './support/e2e-helpers.js';

// P2-3: BulkImportRecipientsDto allows up to 1000 recipients (name <=200 chars, email <=255
// chars) — a realistic near-maximum payload is well over Express/Nest's default 100kb JSON
// body-parser limit, so it used to 413 before ever reaching DTO validation. This boots the app
// through the real createApp() factory (not the shared bootstrapApp() test helper, which builds
// its own NestApplication via createNestApplication() and never runs create-app.ts's bootstrap at
// all) so the actual production body-parser configuration is what's under test here.
describe('Bulk recipient import — body-size limit (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agencyId: string;
  let clientId: string;
  let ownerToken: string;
  let campaignId: string;

  const suffix = e2eSuffix();
  const password = 'password12345';

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    prisma = app.get(PrismaService);

    const owner = await registerAndVerify(
      app,
      prisma,
      `E2E BodySize Agency ${suffix}`,
      'Owner',
      `owner-bodysize-${suffix}@e2e.test`,
      password,
    );
    ownerToken = owner.accessToken;
    agencyId = owner.agencyId;

    clientId = await createClient(app, ownerToken, `E2E BodySize Client ${suffix}`);

    const campaignRes = await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'E2E Body-Size Campaign', subject: 'Hello', bodyTemplate: 'Hi {{name}}' })
      .expect(201);
    campaignId = campaignRes.body.id as string;
  });

  afterAll(async () => {
    await cleanupAgency(prisma, agencyId);
    await app.close();
  });

  it('accepts a realistic near-maximum bulk import (1000 recipients at the DTO field-length caps) that exceeds the old 100kb default', async () => {
    // Each row: 200-char name + a long-but-valid, unique email (long dotted domain keeps every
    // local part short and fixed-width, so length stays well under the 255-char cap regardless
    // of the row index 0-999).
    const domain = `${'sub.'.repeat(50)}example.com`;
    const recipients = Array.from({ length: 1000 }, (_, i) => ({
      name: 'A'.repeat(200),
      email: `u${i}@${domain}`,
    }));
    const payload = JSON.stringify({ recipients });
    expect(Buffer.byteLength(payload)).toBeGreaterThan(100 * 1024); // over the OLD default limit
    expect(Buffer.byteLength(payload)).toBeLessThan(2 * 1024 * 1024); // under the NEW limit

    await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns/${campaignId}/recipients/bulk`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ recipients })
      .expect(201);
  });

  it('still rejects a request whose body exceeds the new 2mb transport limit, before DTO validation runs', async () => {
    // Deliberately bigger than any value BulkImportRecipientsDto could ever produce (1000 rows x
    // 200/255 chars is ~878KB max) — proves the transport-level cap still exists and still works,
    // independent of the DTO's own row/field limits.
    const oversizedName = 'A'.repeat(3 * 1024 * 1024);
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns/${campaignId}/recipients/bulk`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ recipients: [{ name: oversizedName, email: 'oversized@example.com' }] })
      .expect(413);
  });

  it('still rejects invalid recipient data via normal DTO validation (unaffected by the limit change)', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns/${campaignId}/recipients/bulk`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ recipients: [{ name: 'Valid Name', email: 'not-an-email' }] })
      .expect(400);
  });

  it('still enforces existing authorization on this endpoint', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns/${campaignId}/recipients/bulk`)
      .send({ recipients: [{ name: 'No Auth', email: 'noauth@example.com' }] })
      .expect(401);
  });
});
