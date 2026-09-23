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
  e2eSuffix,
  login,
  registerAndVerify,
} from './support/e2e-helpers.js';

// ClientsController: access grant/revoke and soft-delete are OWNER/ADMIN only, and
// ClientAccessGuard is the real tenant boundary for a MANAGER with no grant. Exercised end-to-end
// here rather than just at the service layer (clients.service.spec.ts already covers the logic;
// this proves the guard is actually wired to the routes).
describe('Clients access & soft-delete RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agencyId: string;
  let clientId: string;
  let ownerToken: string;
  let managerToken: string;
  let managerUserId: string;

  const suffix = e2eSuffix();
  const password = 'password12345';

  beforeAll(async () => {
    ({ app, prisma } = await bootstrapApp());

    const owner = await registerAndVerify(app, prisma, `E2E ClientAccess Agency ${suffix}`, 'Owner', `owner-${suffix}@e2e.test`, password);
    ownerToken = owner.accessToken;
    agencyId = owner.agencyId;

    clientId = await createClient(app, ownerToken, `E2E ClientAccess Client ${suffix}`);

    // Created with no clientIds — this MANAGER starts with zero grants, exercising
    // ClientAccessGuard's "no user_client_access row" branch.
    const managerEmail = `manager-${suffix}@e2e.test`;
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: managerEmail, name: 'Manager', password, role: Role.MANAGER })
      .expect(201);
    managerToken = await login(app, managerEmail, password);
    const managerUser = await prisma.user.findUniqueOrThrow({ where: { email: managerEmail } });
    managerUserId = managerUser.id;
  });

  afterAll(async () => {
    await cleanupAgency(prisma, agencyId);
    await app.close();
  });

  it('forbids a MANAGER with no grant from viewing the client', async () => {
    await request(app.getHttpServer())
      .get(`/clients/${clientId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(403);
  });

  it('forbids a MANAGER from granting themselves access', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/access`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ userId: managerUserId, role: 'MANAGER' })
      .expect(403);
  });

  it('allows the OWNER to grant access, after which the MANAGER can view the client', async () => {
    await request(app.getHttpServer())
      .post(`/clients/${clientId}/access`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: managerUserId, role: 'MANAGER' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/clients/${clientId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);
  });

  it('revokes access, after which the MANAGER is blocked again', async () => {
    await request(app.getHttpServer())
      .delete(`/clients/${clientId}/access/${managerUserId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/clients/${clientId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(403);
  });

  it('forbids a MANAGER from soft-deleting a client', async () => {
    await request(app.getHttpServer())
      .delete(`/clients/${clientId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(403);
  });

  it('soft-deletes then restores a client as the OWNER — a full recoverable round trip', async () => {
    await request(app.getHttpServer())
      .delete(`/clients/${clientId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const deletedList = await request(app.getHttpServer())
      .get('/clients/deleted')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    if (!deletedList.body.some((c: { id: string }) => c.id === clientId)) {
      throw new Error('Soft-deleted client did not appear in GET /clients/deleted');
    }

    await request(app.getHttpServer())
      .post(`/clients/${clientId}/restore`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .get(`/clients/${clientId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });
});
