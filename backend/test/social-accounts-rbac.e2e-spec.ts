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

// SocialAccountsController's CAN_MANAGE (OWNER/ADMIN/MANAGER — excludes CREATOR/DESIGNER/CLIENT/
// ANALYST) gates connecting/removing accounts holding live OAuth tokens. Only exercises the
// manual-entry create() and remove() paths for the ALLOW case — the OAuth connect/:platform
// routes need real provider config this test env doesn't set (same reasoning the other e2e specs
// use to avoid Razorpay/OAuth/Azure AI calls), so those are only exercised for the FORBID case,
// which 403s at RolesGuard before ever reaching the OAuth client.
describe('Social Accounts RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agencyId: string;
  let clientId: string;
  let ownerToken: string;
  let creatorToken: string;
  let accountId: string;

  const suffix = e2eSuffix();
  const password = 'password12345';

  beforeAll(async () => {
    ({ app, prisma } = await bootstrapApp());

    const owner = await registerAndVerify(app, prisma, `E2E SocialAccounts Agency ${suffix}`, 'Owner', `owner-${suffix}@e2e.test`, password);
    ownerToken = owner.accessToken;
    agencyId = owner.agencyId;

    clientId = await createClient(app, ownerToken, `E2E SocialAccounts Client ${suffix}`);
    creatorToken = await createMember(app, ownerToken, `creator-${suffix}@e2e.test`, 'Creator', Role.CREATOR, [clientId], password);
  });

  afterAll(async () => {
    await cleanupAgency(prisma, agencyId);
    await app.close();
  });

  it('forbids a CREATOR from manually adding a social account', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/social-accounts`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ platform: 'PINTEREST', label: 'Should be blocked' })
      .expect(403);
  });

  it('forbids a CREATOR from starting the Facebook OAuth connect flow', async () => {
    await request(app.getHttpServer())
      .get(`/clients/${clientId}/social-accounts/facebook/connect`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .expect(403);
  });

  it('allows a CREATOR to view the connected-accounts list (view is open)', async () => {
    await request(app.getHttpServer())
      .get(`/clients/${clientId}/social-accounts`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .expect(200);
  });

  it('allows the OWNER to manually add and remove a social account', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/clients/${clientId}/social-accounts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ platform: 'PINTEREST', label: 'E2E Manual Account' })
      .expect(201);
    accountId = createRes.body.id as string;

    await request(app.getHttpServer())
      .delete(`/clients/${clientId}/social-accounts/${accountId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });
});
