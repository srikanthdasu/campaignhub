import { afterAll, beforeAll, describe, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { Role } from './../src/generated/prisma/client.js';
import { bootstrapApp, cleanupAgency, createMember, e2eSuffix, registerAndVerify } from './support/e2e-helpers.js';

// UsersController: member management (list/create/role/password/active) is OWNER/ADMIN only;
// updateRole additionally blocks an ADMIN from promoting anyone to OWNER (privilege escalation —
// already covered at the service layer in users.service.spec.ts, exercised here through the real
// guard/decorator stack); the two SUPER_ADMIN-only routes must 403 for a regular OWNER.
describe('Users RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agencyId: string;
  let ownerToken: string;
  let adminToken: string;
  let managerToken: string;
  let managerUserId: string;

  const suffix = e2eSuffix();
  const password = 'password12345';

  beforeAll(async () => {
    ({ app, prisma } = await bootstrapApp());

    const owner = await registerAndVerify(app, prisma, `E2E Users Agency ${suffix}`, 'Owner', `owner-${suffix}@e2e.test`, password);
    ownerToken = owner.accessToken;
    agencyId = owner.agencyId;

    adminToken = await createMember(app, ownerToken, `admin-${suffix}@e2e.test`, 'Admin', Role.ADMIN, [], password);
    managerToken = await createMember(app, ownerToken, `manager-${suffix}@e2e.test`, 'Manager', Role.MANAGER, [], password);
    const managerUser = await prisma.user.findUniqueOrThrow({ where: { email: `manager-${suffix}@e2e.test` } });
    managerUserId = managerUser.id;
  });

  afterAll(async () => {
    await cleanupAgency(prisma, agencyId);
    await app.close();
  });

  it('forbids a MANAGER from listing agency members', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(403);
  });

  it('forbids a MANAGER from changing another user\'s role', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${managerUserId}/role`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ role: 'CREATOR' })
      .expect(403);
  });

  it('forbids an ADMIN from promoting a member to OWNER (privilege escalation)', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${managerUserId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'OWNER' })
      .expect(403);
  });

  it('allows the OWNER to promote a member to OWNER', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${managerUserId}/role`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'OWNER' })
      .expect(200);

    // Demote back to MANAGER — this agency now has two Owners after the promotion above, so
    // demoting one is allowed (the "must always have at least one Owner" guard only blocks
    // dropping the *last* one) and keeps later tests' assumptions about managerUserId's role valid.
    await request(app.getHttpServer())
      .patch(`/users/${managerUserId}/role`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'MANAGER' })
      .expect(200);
  });

  it('forbids a regular OWNER from the SUPER_ADMIN-only agencies list', async () => {
    await request(app.getHttpServer())
      .get('/users/agencies')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(403);
  });

  it('forbids a regular OWNER from act-as-agency', async () => {
    await request(app.getHttpServer())
      .patch('/users/me/act-as-agency')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ agencyId })
      .expect(403);
  });

  it('allows an ADMIN to deactivate a member (setActive is OWNER/ADMIN)', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${managerUserId}/active`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(200);
  });
});
