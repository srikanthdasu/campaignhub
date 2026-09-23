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

// DashboardController: GET /dashboard/overview is an agency-wide rollup across every client — a
// CLIENT-role portal user must never see it (would leak other clients' content and the agency's
// own activity feed). This is the exact gap FE-2 flagged as the closest thing to a real issue in
// that audit (no frontend guard existed either, until FE-2's fix) — the backend NON_CLIENT_ROLES
// gate is the real boundary; this proves it's actually wired.
describe('Dashboard RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agencyId: string;
  let ownerToken: string;
  let clientRoleToken: string;

  const suffix = e2eSuffix();
  const password = 'password12345';

  beforeAll(async () => {
    ({ app, prisma } = await bootstrapApp());

    const owner = await registerAndVerify(app, prisma, `E2E Dashboard Agency ${suffix}`, 'Owner', `owner-${suffix}@e2e.test`, password);
    ownerToken = owner.accessToken;
    agencyId = owner.agencyId;

    const clientId = await createClient(app, ownerToken, `E2E Dashboard Client ${suffix}`);
    clientRoleToken = await createMember(app, ownerToken, `client-${suffix}@e2e.test`, 'Client User', Role.CLIENT, [clientId], password);
  });

  afterAll(async () => {
    await cleanupAgency(prisma, agencyId);
    await app.close();
  });

  it('forbids a CLIENT-role user from the agency-wide dashboard rollup', async () => {
    await request(app.getHttpServer())
      .get('/dashboard/overview')
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .expect(403);
  });

  it('allows the OWNER to view the dashboard', async () => {
    await request(app.getHttpServer())
      .get('/dashboard/overview')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });
});
