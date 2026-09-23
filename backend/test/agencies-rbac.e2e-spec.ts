import { afterAll, beforeAll, describe, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { Role } from './../src/generated/prisma/client.js';
import { bootstrapApp, cleanupAgency, createMember, e2eSuffix, registerAndVerify } from './support/e2e-helpers.js';

// AgenciesController: viewing the agency's own record is open to anyone authenticated in it, but
// updating settings (name, billing/timezone/brand settings) is OWNER/ADMIN only.
describe('Agencies RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agencyId: string;
  let ownerToken: string;
  let managerToken: string;

  const suffix = e2eSuffix();
  const password = 'password12345';

  beforeAll(async () => {
    ({ app, prisma } = await bootstrapApp());

    const owner = await registerAndVerify(app, prisma, `E2E Agencies Agency ${suffix}`, 'Owner', `owner-${suffix}@e2e.test`, password);
    ownerToken = owner.accessToken;
    agencyId = owner.agencyId;

    managerToken = await createMember(app, ownerToken, `manager-${suffix}@e2e.test`, 'Manager', Role.MANAGER, [], password);
  });

  afterAll(async () => {
    await cleanupAgency(prisma, agencyId);
    await app.close();
  });

  it('allows a MANAGER to view the agency record', async () => {
    await request(app.getHttpServer())
      .get('/agencies/me')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);
  });

  it('forbids a MANAGER from updating agency settings', async () => {
    await request(app.getHttpServer())
      .patch('/agencies/me/settings')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Should be blocked' })
      .expect(403);
  });

  it('allows the OWNER to update agency settings', async () => {
    const res = await request(app.getHttpServer())
      .patch('/agencies/me/settings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: `Renamed Agency ${suffix}` })
      .expect(200);
    if (res.body.name !== `Renamed Agency ${suffix}`) {
      throw new Error(`Expected the rename to persist, got: ${JSON.stringify(res.body)}`);
    }
  });
});
