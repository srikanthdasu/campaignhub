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

// AUTH-4: neither /simulate nor /:id/reply had a role gate — any granted role, including CLIENT
// and ANALYST, could inject fabricated inbound messages or reply to a real one on the agency's
// behalf. Exercised through the real guard stack here.
describe('Inbox RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agencyId: string;
  let clientId: string;
  let ownerToken: string;
  let analystToken: string;
  let clientRoleToken: string;
  let messageId: string;

  const suffix = e2eSuffix();
  const password = 'password12345';

  beforeAll(async () => {
    ({ app, prisma } = await bootstrapApp());

    const owner = await registerAndVerify(app, prisma, `E2E Inbox Agency ${suffix}`, 'Owner', `owner-${suffix}@e2e.test`, password);
    ownerToken = owner.accessToken;
    agencyId = owner.agencyId;

    clientId = await createClient(app, ownerToken, `E2E Inbox Client ${suffix}`);

    analystToken = await createMember(app, ownerToken, `analyst-${suffix}@e2e.test`, 'Analyst', Role.ANALYST, [clientId], password);
    clientRoleToken = await createMember(app, ownerToken, `client-${suffix}@e2e.test`, 'Client User', Role.CLIENT, [clientId], password);

    const messageRes = await request(app.getHttpServer())
      .post(`/clients/${clientId}/inbox/simulate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ platform: 'INSTAGRAM', senderName: 'E2E Sender', message: 'Test inbound message' })
      .expect(201);
    messageId = messageRes.body.id as string;
  });

  afterAll(async () => {
    await cleanupAgency(prisma, agencyId);
    await app.close();
  });

  it('forbids a CLIENT-role user from injecting a simulated message', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/inbox/simulate`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .send({ platform: 'INSTAGRAM', senderName: 'Fake', message: 'Should be blocked' })
      .expect(403);
  });

  it('forbids an ANALYST from injecting a simulated message', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/inbox/simulate`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ platform: 'INSTAGRAM', senderName: 'Fake', message: 'Should be blocked' })
      .expect(403);
  });

  it('forbids a CLIENT-role user from replying on the agency\'s behalf', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/inbox/${messageId}/reply`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .send({ reply: 'Should be blocked' })
      .expect(403);
  });

  it('allows a CLIENT-role user to view and mark-read (list/markRead are open)', async () => {
    await request(app.getHttpServer())
      .get(`/clients/${clientId}/inbox`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/clients/${clientId}/inbox/${messageId}/read`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .expect(200);
  });

  it('allows the OWNER to reply', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/inbox/${messageId}/reply`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reply: 'A real reply from the agency' })
      .expect(201);
  });
});
