import { afterAll, beforeAll, describe, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { Role } from './../src/generated/prisma/client.js';
import {
  bootstrapApp,
  cleanupAgency,
  createClient,
  createMember,
  e2eSuffix,
  registerAndVerify,
} from './support/e2e-helpers.js';

// AdsController splits mutations into two tiers — CAN_MANAGE (create/update/submit/delete) and
// the tighter CAN_APPROVE_AND_LAUNCH (review/launch, agency-wide roles only) — exercised here
// through the real guard/decorator stack, which a service-only unit test can't observe.
describe('Ads RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agencyId: string;
  let clientId: string;
  let ownerToken: string;
  let creatorToken: string;
  let clientRoleToken: string;
  let adId: string;

  const suffix = e2eSuffix();
  const password = 'password12345';

  beforeAll(async () => {
    ({ app, prisma } = await bootstrapApp());

    const owner = await registerAndVerify(app, prisma, `E2E Ads Agency ${suffix}`, 'Owner', `owner-${suffix}@e2e.test`, password);
    ownerToken = owner.accessToken;
    agencyId = owner.agencyId;

    clientId = await createClient(app, ownerToken, `E2E Ads Client ${suffix}`);

    // CREATOR is in CAN_MANAGE but not CAN_APPROVE_AND_LAUNCH — the exact split this suite exists
    // to prove actually holds at the HTTP layer.
    creatorToken = await createMember(app, ownerToken, `creator-${suffix}@e2e.test`, 'Creator', Role.CREATOR, [clientId], password);
    clientRoleToken = await createMember(app, ownerToken, `client-${suffix}@e2e.test`, 'Client User', Role.CLIENT, [clientId], password);

    const adRes = await request(app.getHttpServer())
      .post(`/clients/${clientId}/ads`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ name: 'E2E Test Ad', platform: 'FACEBOOK' })
      .expect(201);
    adId = adRes.body.id as string;
  });

  afterAll(async () => {
    await cleanupAgency(prisma, agencyId);
    await app.close();
  });

  it('allows a CREATOR (CAN_MANAGE) to create an ad', async () => {
    // Already proven by the successful beforeAll create — this documents the intent explicitly.
    await request(app.getHttpServer())
      .get(`/clients/${clientId}/ads/${adId}`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .expect(200);
  });

  it('forbids a CLIENT-role user from creating an ad', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/ads`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .send({ name: 'Should be blocked', platform: 'FACEBOOK' })
      .expect(403);
  });

  it('forbids a CREATOR (CAN_MANAGE but not CAN_APPROVE_AND_LAUNCH) from reviewing an ad', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/ads/${adId}/review`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ status: 'APPROVED' })
      .expect(403);
  });

  it('forbids a CREATOR from launching an ad', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/ads/${adId}/launch`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .expect(403);
  });

  it('forbids a CLIENT-role user from deleting an ad', async () => {
    await request(app.getHttpServer())
      .delete(`/clients/${clientId}/ads/${adId}`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .expect(403);
  });

  it('allows the OWNER to review an ad (agency-wide role, in CAN_APPROVE_AND_LAUNCH)', async () => {
    // Budget and creative are required before an ad can be submitted for approval.
    await request(app.getHttpServer())
      .patch(`/clients/${clientId}/ads/${adId}`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ budgetAmount: 100, creativeText: 'E2E creative text' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/ads/${adId}/submit`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/ads/${adId}/review`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'APPROVED' })
      .expect(201);
  });

  it("rejects an ad id that belongs to a different client (tenant isolation via ClientAccessGuard)", async () => {
    const otherClientId = await createClient(app, ownerToken, `E2E Ads Other Client ${suffix}`);
    await request(app.getHttpServer())
      .get(`/clients/${otherClientId}/ads/${adId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);
  });
});
