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

// CampaignsController splits CAN_MANAGE (create/update — includes CREATOR/DESIGNER) from the
// tighter CAN_DELETE (excludes them) — exercised through the real guard stack.
describe('Campaigns RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agencyId: string;
  let clientId: string;
  let ownerToken: string;
  let creatorToken: string;
  let clientRoleToken: string;
  let campaignId: string;

  const suffix = e2eSuffix();
  const password = 'password12345';

  beforeAll(async () => {
    ({ app, prisma } = await bootstrapApp());

    const owner = await registerAndVerify(app, prisma, `E2E Campaigns Agency ${suffix}`, 'Owner', `owner-${suffix}@e2e.test`, password);
    ownerToken = owner.accessToken;
    agencyId = owner.agencyId;

    clientId = await createClient(app, ownerToken, `E2E Campaigns Client ${suffix}`);

    creatorToken = await createMember(app, ownerToken, `creator-${suffix}@e2e.test`, 'Creator', Role.CREATOR, [clientId], password);
    clientRoleToken = await createMember(app, ownerToken, `client-${suffix}@e2e.test`, 'Client User', Role.CLIENT, [clientId], password);

    const campaignRes = await request(app.getHttpServer())
      .post(`/clients/${clientId}/campaigns`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ name: 'E2E Test Campaign' })
      .expect(201);
    campaignId = campaignRes.body.id as string;
  });

  afterAll(async () => {
    await cleanupAgency(prisma, agencyId);
    await app.close();
  });

  it('forbids a CLIENT-role user from creating a campaign', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/campaigns`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .send({ name: 'Should be blocked' })
      .expect(403);
  });

  it('allows a CREATOR (CAN_MANAGE) to update a campaign', async () => {
    await request(app.getHttpServer())
      .patch(`/clients/${clientId}/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ objective: 'Updated by creator' })
      .expect(200);
  });

  it('forbids a CREATOR (CAN_MANAGE but not CAN_DELETE) from deleting a campaign', async () => {
    await request(app.getHttpServer())
      .delete(`/clients/${clientId}/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .expect(403);
  });

  it('rejects a campaign id that belongs to a different client (tenant isolation)', async () => {
    const otherClientId = await createClient(app, ownerToken, `E2E Campaigns Other Client ${suffix}`);
    await request(app.getHttpServer())
      .get(`/clients/${otherClientId}/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);
  });

  it('allows the OWNER (CAN_DELETE) to delete the campaign', async () => {
    await request(app.getHttpServer())
      .delete(`/clients/${clientId}/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });
});
