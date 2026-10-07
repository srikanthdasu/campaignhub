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
// CREATOR, who can manage regular campaigns, is blocked outright. CLIENT sits in between: it's in
// CAN_EDIT (create/update/import/remove-recipient) but never in CAN_MANAGE (delete/send). CLIENT's
// own path to a send is request-send -> PENDING_APPROVAL -> an admin's approve-send/reject-send.
describe('Email Campaigns RBAC (e2e)', () => {
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

    const owner = await registerAndVerify(app, prisma, `E2E EmailCampaigns Agency ${suffix}`, 'Owner', `owner-${suffix}@e2e.test`, password);
    ownerToken = owner.accessToken;
    agencyId = owner.agencyId;

    clientId = await createClient(app, ownerToken, `E2E EmailCampaigns Client ${suffix}`);
    creatorToken = await createMember(app, ownerToken, `creator-${suffix}@e2e.test`, 'Creator', Role.CREATOR, [clientId], password);
    clientRoleToken = await createMember(app, ownerToken, `client-${suffix}@e2e.test`, 'Client User', Role.CLIENT, [clientId], password);

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

  it('allows a CLIENT to create and import recipients, but forbids sending', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .send({ name: 'Client-drafted campaign', subject: 'Hi', bodyTemplate: 'Body {{name}}' })
      .expect(201);
    const clientCampaignId = createRes.body.id as string;

    await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns/${clientCampaignId}/recipients/bulk`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .send({ recipients: [{ name: 'Test', email: 'test@example.com' }] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns/${clientCampaignId}/send`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/clients/${clientId}/email-campaigns/${clientCampaignId}`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .expect(403);
  });

  it('CLIENT can request a send, OWNER can approve it into QUEUED', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .send({ name: 'Approve-path campaign', subject: 'Hi', bodyTemplate: 'Body {{name}}' })
      .expect(201);
    const id = createRes.body.id as string;
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns/${id}/recipients/bulk`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .send({ recipients: [{ name: 'Test', email: 'test@example.com' }] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns/${id}/approve-send`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns/${id}/reject-send`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .send({ reason: 'no' })
      .expect(403);

    const requestRes = await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns/${id}/request-send`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .expect(201);
    expect(requestRes.body.status).toBe('PENDING_APPROVAL');

    const approveRes = await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns/${id}/approve-send`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);
    expect(approveRes.body.status).toBe('QUEUED');
  });

  it('CLIENT can request a send, OWNER can reject it back to DRAFT with a reason', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .send({ name: 'Reject-path campaign', subject: 'Hi', bodyTemplate: 'Body {{name}}' })
      .expect(201);
    const id = createRes.body.id as string;
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns/${id}/recipients/bulk`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .send({ recipients: [{ name: 'Test', email: 'test@example.com' }] })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns/${id}/request-send`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .expect(201);

    const rejectRes = await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns/${id}/reject-send`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'Fix the subject line' })
      .expect(201);
    expect(rejectRes.body.status).toBe('DRAFT');
    expect(rejectRes.body.rejectionReason).toBe('Fix the subject line');
  });

  it('forbids approve-send/reject-send on a campaign that is not PENDING_APPROVAL', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Still a draft', subject: 'Hi', bodyTemplate: 'Body' })
      .expect(201);
    const id = createRes.body.id as string;

    await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns/${id}/approve-send`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-campaigns/${id}/reject-send`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'n/a' })
      .expect(400);
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
