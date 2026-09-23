import { afterAll, beforeAll, describe, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { AiStrategyStatus, Role } from './../src/generated/prisma/client.js';
import {
  bootstrapApp,
  cleanupAgency,
  createClient,
  createMember,
  e2eSuffix,
  registerAndVerify,
} from './support/e2e-helpers.js';

// AiStrategyController splits CAN_CREATE (includes CREATOR/DESIGNER) from the tighter CAN_REVIEW
// (agency-wide roles only — review is the governance gate itself, per the controller's own
// comment). Doesn't call generate() — that hits a real Azure AI Foundry API, same reasoning the
// existing e2e specs already use to avoid AI/OAuth/Razorpay routes.
describe('AI Strategy RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agencyId: string;
  let clientId: string;
  let ownerToken: string;
  let creatorToken: string;
  let strategyId: string;

  const suffix = e2eSuffix();
  const password = 'password12345';

  beforeAll(async () => {
    ({ app, prisma } = await bootstrapApp());

    const owner = await registerAndVerify(app, prisma, `E2E AiStrategy Agency ${suffix}`, 'Owner', `owner-${suffix}@e2e.test`, password);
    ownerToken = owner.accessToken;
    agencyId = owner.agencyId;

    clientId = await createClient(app, ownerToken, `E2E AiStrategy Client ${suffix}`);
    creatorToken = await createMember(app, ownerToken, `creator-${suffix}@e2e.test`, 'Creator', Role.CREATOR, [clientId], password);

    const strategyRes = await request(app.getHttpServer())
      .post(`/clients/${clientId}/ai-strategy`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ title: 'E2E Test Strategy', goal: 'Grow reach' })
      .expect(201);
    strategyId = strategyRes.body.id as string;
  });

  afterAll(async () => {
    await cleanupAgency(prisma, agencyId);
    await app.close();
  });

  it('forbids a CREATOR (CAN_CREATE but not CAN_REVIEW) from reviewing a strategy', async () => {
    await prisma.aiStrategyRequest.update({ where: { id: strategyId }, data: { status: AiStrategyStatus.GENERATED } });

    await request(app.getHttpServer())
      .post(`/clients/${clientId}/ai-strategy/${strategyId}/review`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ status: 'APPROVED' })
      .expect(403);
  });

  it('forbids a CREATOR from deleting a strategy (CAN_REVIEW only)', async () => {
    await request(app.getHttpServer())
      .delete(`/clients/${clientId}/ai-strategy/${strategyId}`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .expect(403);
  });

  it('allows a CREATOR to leave feedback (CAN_CREATE)', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/ai-strategy/${strategyId}/feedback`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ rating: 5 })
      .expect(201);
  });

  it('allows the OWNER (CAN_REVIEW) to approve the strategy', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/ai-strategy/${strategyId}/review`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'APPROVED' })
      .expect(201);
  });
});
