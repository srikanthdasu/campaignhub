import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

// ClientEmailSenderController uses the same CAN_MANAGE tier (OWNER/ADMIN/MANAGER) as
// EmailCampaignsController's delete/send — sender/domain setup is agency-staff infrastructure
// work, not something CLIENT configures themselves (they can draft and request-send a campaign,
// but not decide what it sends *as*). No BREVO_API_KEY is set in this CI environment, so these
// tests exercise the degrade-gracefully path (ClientEmailSenderService's own unit tests cover the
// real Brevo-call branch with mocks) — the row still saves and RBAC/isolation still apply exactly
// the same either way.
describe('Client Email Sender RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agencyId: string;
  let clientId: string;
  let otherClientId: string;
  let ownerToken: string;
  let creatorToken: string;
  let clientRoleToken: string;

  const suffix = e2eSuffix();
  const password = 'password12345';

  beforeAll(async () => {
    ({ app, prisma } = await bootstrapApp());

    const owner = await registerAndVerify(app, prisma, `E2E ClientEmailSender Agency ${suffix}`, 'Owner', `owner-${suffix}@e2e.test`, password);
    ownerToken = owner.accessToken;
    agencyId = owner.agencyId;

    clientId = await createClient(app, ownerToken, `E2E Sender Client ${suffix}`);
    otherClientId = await createClient(app, ownerToken, `E2E Sender Other Client ${suffix}`);
    creatorToken = await createMember(app, ownerToken, `creator-${suffix}@e2e.test`, 'Creator', Role.CREATOR, [clientId], password);
    clientRoleToken = await createMember(app, ownerToken, `client-${suffix}@e2e.test`, 'Client User', Role.CLIENT, [clientId], password);
  });

  afterAll(async () => {
    await cleanupAgency(prisma, agencyId);
    await app.close();
  });

  it('forbids CLIENT from reading, upserting, or verifying the sender', async () => {
    await request(app.getHttpServer())
      .get(`/clients/${clientId}/email-sender`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .put(`/clients/${clientId}/email-sender`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .send({ senderName: 'Should be blocked', senderEmail: 'blocked@example.com' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/email-sender/verify`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .expect(403);
  });

  it('forbids CREATOR from managing the sender (same CAN_MANAGE tier as delete/send)', async () => {
    await request(app.getHttpServer())
      .put(`/clients/${clientId}/email-sender`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ senderName: 'Should be blocked', senderEmail: 'blocked@example.com' })
      .expect(403);
  });

  it('allows OWNER to configure and read a sender for their client', async () => {
    const upsertRes = await request(app.getHttpServer())
      .put(`/clients/${clientId}/email-sender`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ senderName: 'Upshift Services', senderEmail: 'info@upshiftservices.com' })
      .expect(200);
    expect(upsertRes.body.sender.senderEmail).toBe('info@upshiftservices.com');
    expect(upsertRes.body.sender.domain).toBe('upshiftservices.com');
    expect(upsertRes.body.sender.verificationStatus).toBe('PENDING');

    const getRes = await request(app.getHttpServer())
      .get(`/clients/${clientId}/email-sender`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(getRes.body.senderEmail).toBe('info@upshiftservices.com');
  });

  it("rejects an invalid sender email with a 400, not silently accepting it", async () => {
    await request(app.getHttpServer())
      .put(`/clients/${clientId}/email-sender`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ senderName: 'Bad', senderEmail: 'not-an-email' })
      .expect(400);
  });

  it("does not leak one client's sender through another client's id (tenant isolation)", async () => {
    await request(app.getHttpServer())
      .put(`/clients/${clientId}/email-sender`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ senderName: 'Upshift Services', senderEmail: 'info@upshiftservices.com' })
      .expect(200);

    const otherRes = await request(app.getHttpServer())
      .get(`/clients/${otherClientId}/email-sender`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    // No sender configured for the other client — must not somehow return the first client's row.
    // (A literal JSON `null` body parses as `{}` via supertest, not `null` — check the field
    // itself is absent rather than asserting on the whole body shape.)
    expect(otherRes.body.senderEmail).toBeUndefined();
  });
});
