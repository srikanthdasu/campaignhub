import { afterAll, beforeAll, describe, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { ContentStatus, Role } from './../src/generated/prisma/client.js';
import {
  bootstrapApp,
  cleanupAgency,
  createClient,
  createMember,
  e2eSuffix,
  registerAndVerify,
} from './support/e2e-helpers.js';

// ContentController applies ClientContentCreationGuard at the controller level (not scoped to
// just the create route, unlike ai-assistant.controller.ts) — so a CLIENT with
// allowClientContentCreation still off (the default) is blocked from the whole surface, list
// included, not just from creating. Confirmed as the same consistent pattern in
// ai-captions.controller.ts and ai-video-studio.controller.ts, so this locks in real,
// intentional-looking behavior rather than assuming it's a bug.
describe('Content RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agencyId: string;
  let clientId: string;
  let ownerToken: string;
  let analystToken: string;
  let clientRoleToken: string;
  let contentId: string;

  const suffix = e2eSuffix();
  const password = 'password12345';

  beforeAll(async () => {
    ({ app, prisma } = await bootstrapApp());

    const owner = await registerAndVerify(app, prisma, `E2E Content Agency ${suffix}`, 'Owner', `owner-${suffix}@e2e.test`, password);
    ownerToken = owner.accessToken;
    agencyId = owner.agencyId;

    clientId = await createClient(app, ownerToken, `E2E Content Client ${suffix}`);

    // ANALYST is excluded from CAN_CREATE_CONTENT entirely — the "can view but never create
    // anywhere" role.
    analystToken = await createMember(app, ownerToken, `analyst-${suffix}@e2e.test`, 'Analyst', Role.ANALYST, [clientId], password);
    clientRoleToken = await createMember(app, ownerToken, `client-${suffix}@e2e.test`, 'Client User', Role.CLIENT, [clientId], password);

    const contentRes = await request(app.getHttpServer())
      .post(`/clients/${clientId}/content`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ type: 'POST', body: 'E2E test content', platforms: ['INSTAGRAM'] })
      .expect(201);
    contentId = contentRes.body.id as string;
  });

  afterAll(async () => {
    await cleanupAgency(prisma, agencyId);
    await app.close();
  });

  it('forbids an ANALYST from creating content', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/content`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ type: 'POST', body: 'Should be blocked', platforms: ['INSTAGRAM'] })
      .expect(403);
  });

  it('forbids a CLIENT-role user from even listing content while allowClientContentCreation is off (the default)', async () => {
    await request(app.getHttpServer())
      .get(`/clients/${clientId}/content`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .expect(403);
  });

  it('allows the CLIENT to list and create once the agency opts them in', async () => {
    await request(app.getHttpServer())
      .patch(`/clients/${clientId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ allowClientContentCreation: true })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/clients/${clientId}/content`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/clients/${clientId}/content`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .send({ type: 'POST', body: 'Client-created content', platforms: ['INSTAGRAM'] })
      .expect(201);
  });

  it('rejects editing content that is no longer in an editable state', async () => {
    await prisma.contentItem.update({ where: { id: contentId }, data: { status: ContentStatus.IN_REVIEW } });

    await request(app.getHttpServer())
      .patch(`/clients/${clientId}/content/${contentId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ body: 'Trying to edit while in review' })
      .expect(400);
  });

  it('rejects a content id that belongs to a different client (tenant isolation)', async () => {
    const otherClientId = await createClient(app, ownerToken, `E2E Content Other Client ${suffix}`);
    await request(app.getHttpServer())
      .get(`/clients/${otherClientId}/content/${contentId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);
  });
});
