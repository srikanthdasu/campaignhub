import { afterAll, beforeAll, describe, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { MediaType, Role } from './../src/generated/prisma/client.js';
import {
  bootstrapApp,
  cleanupAgency,
  createClient,
  createMember,
  e2eSuffix,
  registerAndVerify,
} from './support/e2e-helpers.js';

// AUTH-4: media.controller.ts previously had no @Roles at all on update/delete/bulk-delete — any
// granted role, including CLIENT/ANALYST, could edit or permanently delete another user's media.
// CAN_MANAGE now excludes both. Exercised here through the real guard stack — a service-only unit
// test can observe the service logic but not whether the controller's decorator is actually wired.
describe('Media RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agencyId: string;
  let clientId: string;
  let ownerToken: string;
  let analystToken: string;
  let clientRoleToken: string;
  let assetId: string;

  const suffix = e2eSuffix();
  const password = 'password12345';

  beforeAll(async () => {
    ({ app, prisma } = await bootstrapApp());

    const owner = await registerAndVerify(app, prisma, `E2E Media Agency ${suffix}`, 'Owner', `owner-${suffix}@e2e.test`, password);
    ownerToken = owner.accessToken;
    agencyId = owner.agencyId;

    clientId = await createClient(app, ownerToken, `E2E Media Client ${suffix}`);

    analystToken = await createMember(app, ownerToken, `analyst-${suffix}@e2e.test`, 'Analyst', Role.ANALYST, [clientId], password);
    clientRoleToken = await createMember(app, ownerToken, `client-${suffix}@e2e.test`, 'Client User', Role.CLIENT, [clientId], password);

    // Bypasses the multipart upload route (real file handling isn't what this suite exercises) —
    // same "skip the unrelated flow" pattern as scheduler-rbac.e2e-spec.ts bypassing approvals.
    const asset = await prisma.mediaAsset.create({
      data: {
        clientId,
        fileName: 'e2e-test.png',
        storageUrl: 'https://example.com/e2e-test.png',
        type: MediaType.IMAGE,
        fileSize: 1024,
        uploadedById: owner.userId,
      },
    });
    assetId = asset.id;
  });

  afterAll(async () => {
    await cleanupAgency(prisma, agencyId);
    await app.close();
  });

  it('forbids an ANALYST from updating a media asset', async () => {
    await request(app.getHttpServer())
      .patch(`/clients/${clientId}/media/${assetId}`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ title: 'Should be blocked' })
      .expect(403);
  });

  it('forbids a CLIENT-role user from deleting a media asset', async () => {
    await request(app.getHttpServer())
      .delete(`/clients/${clientId}/media/${assetId}`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .expect(403);
  });

  it('forbids an ANALYST from bulk-deleting media assets', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/media/bulk-delete`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ ids: [assetId] })
      .expect(403);
  });

  it('allows a CLIENT-role user to view the media list (view is open, matching FE-2 scoping)', async () => {
    await request(app.getHttpServer())
      .get(`/clients/${clientId}/media`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .expect(200);
  });

  it('allows the OWNER to update and delete the asset', async () => {
    await request(app.getHttpServer())
      .patch(`/clients/${clientId}/media/${assetId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Updated by owner' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/clients/${clientId}/media/${assetId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });
});
