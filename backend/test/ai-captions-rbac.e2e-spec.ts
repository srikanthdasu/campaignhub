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

// AiCaptionsController: CAN_CREATE excludes only ANALYST (includes CLIENT). Doesn't call
// generate() — real Azure AI Foundry call, avoided the same way the other AI-route specs avoid
// it. ClientContentCreationGuard is applied at the controller level here too (same as
// content.controller.ts/ai-video-studio.controller.ts), so a CLIENT with content creation
// disabled is blocked from list() as well, not just save().
describe('AI Captions RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agencyId: string;
  let clientId: string;
  let ownerToken: string;
  let analystToken: string;

  const suffix = e2eSuffix();
  const password = 'password12345';

  beforeAll(async () => {
    ({ app, prisma } = await bootstrapApp());

    const owner = await registerAndVerify(app, prisma, `E2E AiCaptions Agency ${suffix}`, 'Owner', `owner-${suffix}@e2e.test`, password);
    ownerToken = owner.accessToken;
    agencyId = owner.agencyId;

    clientId = await createClient(app, ownerToken, `E2E AiCaptions Client ${suffix}`);
    analystToken = await createMember(app, ownerToken, `analyst-${suffix}@e2e.test`, 'Analyst', Role.ANALYST, [clientId], password);
  });

  afterAll(async () => {
    await cleanupAgency(prisma, agencyId);
    await app.close();
  });

  it('forbids an ANALYST from saving a caption', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/ai-captions`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ input: 'A product launch', text: 'Should be blocked' })
      .expect(403);
  });

  it('allows an ANALYST to view the saved captions list (list has no @Roles — view is open)', async () => {
    await request(app.getHttpServer())
      .get(`/clients/${clientId}/ai-captions`)
      .set('Authorization', `Bearer ${analystToken}`)
      .expect(200);
  });

  it('allows the OWNER to save, list, and delete a caption', async () => {
    const saveRes = await request(app.getHttpServer())
      .post(`/clients/${clientId}/ai-captions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ input: 'A product launch', text: 'Check out our new product!' })
      .expect(201);
    const captionId = saveRes.body.id as string;

    await request(app.getHttpServer())
      .get(`/clients/${clientId}/ai-captions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/clients/${clientId}/ai-captions/${captionId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });
});
