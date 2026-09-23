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

// EmailCampaignsController's CAN_MANAGE is deliberately tighter than Campaigns'/Content's
// (excludes CREATOR/DESIGNER — a bad send carries real reputational/compliance risk against the
// agency's own sending identity, per the controller's own comment). This is the one place a
// CREATOR, who can manage regular campaigns, is blocked outright.
describe('Email Campaigns RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agencyId: string;
  let clientId: string;
  let ownerToken: string;
  let creatorToken: string;
  let campaignId: string;

  const suffix = e2eSuffix();
  const password = 'password12345';

  beforeAll(async () => {
    ({ app, prisma } = await bootstrapApp());

    const owner = await registerAndVerify(app, prisma, `E2E EmailCampaigns Agency ${suffix}`, 'Owner', `owner-${suffix}@e2e.test`, password);
    ownerToken = owner.accessToken;
    agencyId = owner.agencyId;

    clientId = await createClient(app, ownerToken, `E2E EmailCampaigns Client ${suffix}`);
    creatorToken = await createMember(app, ownerToken, `creator-${suffix}@e2e.test`, 'Creator', Role.CREATOR, [clientId], password);

    const campaignRes = await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'E2E Test Campaign', subject: 'Hello', bodyTemplate: 'Hi {{name}}' })
      .expect(201);
    campaignId = campaignRes.body.id as string;
  });

  afterAll(async () => {
    await cleanupAgency(prisma, agencyId);
    await app.close();
  });

  it('forbids a CREATOR from creating an email campaign (excluded even though they can manage regular campaigns)', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ name: 'Should be blocked', subject: 'Hi', bodyTemplate: 'Body' })
      .expect(403);
  });

  it('forbids a CREATOR from importing recipients', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns/${campaignId}/recipients/bulk`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ recipients: [{ name: 'Test', email: 'test@example.com' }] })
      .expect(403);
  });

  it('forbids a CREATOR from sending', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns/${campaignId}/send`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .expect(403);
  });

  it('allows a CREATOR to view the campaign list (view is open)', async () => {
    await request(app.getHttpServer())
      .get(`/clients/${clientId}/email-campaigns`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .expect(200);
  });

  it('allows the OWNER to import recipients and delete the campaign', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns/${campaignId}/recipients/bulk`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ recipients: [{ name: 'Test', email: 'test@example.com' }] })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/clients/${clientId}/email-campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });
});
