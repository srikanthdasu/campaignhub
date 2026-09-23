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

// AUTH-4: DELETE previously had no role gate at all — any granted role, including CLIENT/ANALYST,
// could delete any conversation, not just their own (no per-creator ownership check). create()
// deliberately has no @Roles at all (any client-scoped role can start a conversation) — the
// asymmetry (open create, gated delete) is exactly what this suite exists to lock in. Doesn't
// call ask() — real Azure AI Foundry call, avoided the same way the other AI-route specs avoid it.
describe('AI Assistant RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agencyId: string;
  let clientId: string;
  let ownerToken: string;
  let analystToken: string;
  let conversationId: string;

  const suffix = e2eSuffix();
  const password = 'password12345';

  beforeAll(async () => {
    ({ app, prisma } = await bootstrapApp());

    const owner = await registerAndVerify(app, prisma, `E2E AiAssistant Agency ${suffix}`, 'Owner', `owner-${suffix}@e2e.test`, password);
    ownerToken = owner.accessToken;
    agencyId = owner.agencyId;

    clientId = await createClient(app, ownerToken, `E2E AiAssistant Client ${suffix}`);
    analystToken = await createMember(app, ownerToken, `analyst-${suffix}@e2e.test`, 'Analyst', Role.ANALYST, [clientId], password);
  });

  afterAll(async () => {
    await cleanupAgency(prisma, agencyId);
    await app.close();
  });

  it('allows an ANALYST to start a conversation (create has no @Roles)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/clients/${clientId}/ai-assistant/conversations`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ title: 'Analyst conversation' })
      .expect(201);
    conversationId = res.body.id as string;
  });

  it("forbids the ANALYST from deleting their own conversation (AUTH-4's fix — CAN_MANAGE excludes ANALYST)", async () => {
    await request(app.getHttpServer())
      .delete(`/clients/${clientId}/ai-assistant/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${analystToken}`)
      .expect(403);
  });

  it('allows the OWNER to delete the conversation', async () => {
    await request(app.getHttpServer())
      .delete(`/clients/${clientId}/ai-assistant/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });
});
