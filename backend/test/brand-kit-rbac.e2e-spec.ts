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

// BrandKitController: viewing is open to any client-scoped role, but upsert (which sets
// voiceGuidelines/aiContext — read into every AI Captions prompt since the FEAT-3 fix) is
// OWNER/ADMIN/MANAGER only, excluding CREATOR even though a CREATOR can generate AI captions that
// read from it.
describe('Brand Kit RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agencyId: string;
  let clientId: string;
  let ownerToken: string;
  let creatorToken: string;

  const suffix = e2eSuffix();
  const password = 'password12345';

  beforeAll(async () => {
    ({ app, prisma } = await bootstrapApp());

    const owner = await registerAndVerify(app, prisma, `E2E BrandKit Agency ${suffix}`, 'Owner', `owner-${suffix}@e2e.test`, password);
    ownerToken = owner.accessToken;
    agencyId = owner.agencyId;

    clientId = await createClient(app, ownerToken, `E2E BrandKit Client ${suffix}`);
    creatorToken = await createMember(app, ownerToken, `creator-${suffix}@e2e.test`, 'Creator', Role.CREATOR, [clientId], password);
  });

  afterAll(async () => {
    await cleanupAgency(prisma, agencyId);
    await app.close();
  });

  it('forbids a CREATOR from upserting the brand kit', async () => {
    await request(app.getHttpServer())
      .put(`/clients/${clientId}/brand-kit`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ voiceGuidelines: 'Should be blocked' })
      .expect(403);
  });

  it('allows a CREATOR to view the brand kit', async () => {
    await request(app.getHttpServer())
      .get(`/clients/${clientId}/brand-kit`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .expect(200);
  });

  it('allows the OWNER to upsert the brand kit', async () => {
    const res = await request(app.getHttpServer())
      .put(`/clients/${clientId}/brand-kit`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ voiceGuidelines: 'Friendly and concise', primaryColor: '#5b63f5' })
      .expect(200);
    if (res.body.voiceGuidelines !== 'Friendly and concise') {
      throw new Error(`Expected voiceGuidelines to be saved, got: ${JSON.stringify(res.body)}`);
    }
  });
});
