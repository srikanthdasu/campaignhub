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

// AiVideoStudioController: CAN_CREATE excludes only ANALYST. Only exercises create/list/delete —
// script/render/export hit real Azure AI/blob storage, avoided the same way the other AI-route
// specs avoid external calls.
describe('AI Video Studio RBAC (e2e)', () => {
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

    const owner = await registerAndVerify(app, prisma, `E2E AiVideo Agency ${suffix}`, 'Owner', `owner-${suffix}@e2e.test`, password);
    ownerToken = owner.accessToken;
    agencyId = owner.agencyId;

    clientId = await createClient(app, ownerToken, `E2E AiVideo Client ${suffix}`);
    analystToken = await createMember(app, ownerToken, `analyst-${suffix}@e2e.test`, 'Analyst', Role.ANALYST, [clientId], password);
  });

  afterAll(async () => {
    await cleanupAgency(prisma, agencyId);
    await app.close();
  });

  it('forbids an ANALYST from creating a video project', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/ai-video-studio/projects`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ title: 'Should be blocked' })
      .expect(403);
  });

  it('allows the OWNER to create, list, and delete a video project', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/clients/${clientId}/ai-video-studio/projects`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'E2E Test Video', idea: 'A product demo' })
      .expect(201);
    const projectId = createRes.body.id as string;

    await request(app.getHttpServer())
      .get(`/clients/${clientId}/ai-video-studio/projects`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/clients/${clientId}/ai-video-studio/projects/${projectId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });
});
