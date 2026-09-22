import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { Role } from './../src/generated/prisma/client.js';

// Exercises the AUTH-1 fix end-to-end through the real HTTP/guard/service stack:
// ApprovalsController has no ClientAccessGuard (its routes carry no :clientId), so the only
// thing standing between a MANAGER and another staff member's approval flow is
// ApprovalsService.getById's own isAgencyWide/isAssignedApprover logic — exactly the kind of
// decorator-adjacent, request-pipeline behavior a service-only unit test (mocked Prisma) can't
// fully observe. See approvals.service.spec.ts for the unit-level coverage this complements.
describe('Approvals RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agencyId: string;
  let flowId: string;
  let approverManagerToken: string;
  let otherManagerToken: string;

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const ownerEmail = `owner-${suffix}@e2e.test`;
  const approverManagerEmail = `approver-mgr-${suffix}@e2e.test`;
  const otherManagerEmail = `other-mgr-${suffix}@e2e.test`;
  const password = 'password12345';

  async function login(email: string) {
    const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return res.body.accessToken as string;
  }

  async function registerAndVerify(agencyName: string, name: string, email: string) {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ agencyName, name, email, password })
      .expect(201);
    await prisma.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
    const accessToken = await login(email);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return { accessToken, user: { id: user.id as string, agencyId: user.agencyId as string } };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const owner = await registerAndVerify(`E2E Approvals Agency ${suffix}`, 'Owner', ownerEmail);
    const ownerToken = owner.accessToken;
    agencyId = owner.user.agencyId;

    const clientRes = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: `E2E Client ${suffix}` })
      .expect(201);
    const clientId = clientRes.body.id as string;

    const approverManagerRes = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: approverManagerEmail, name: 'Approver Manager', password, role: Role.MANAGER, clientIds: [clientId] })
      .expect(201);
    const approverManagerId = approverManagerRes.body.id as string;

    // Deliberately no clientIds grant, and never named as an approver — this is the exact
    // MANAGER-without-relationship-to-the-flow case AUTH-1 let through.
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: otherManagerEmail, name: 'Other Manager', password, role: Role.MANAGER, clientIds: [] })
      .expect(201);

    approverManagerToken = await login(approverManagerEmail);
    otherManagerToken = await login(otherManagerEmail);

    const contentRes = await request(app.getHttpServer())
      .post(`/clients/${clientId}/content`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ type: 'POST', body: 'E2E approvals test content', platforms: ['INSTAGRAM'] })
      .expect(201);
    const contentId = contentRes.body.id as string;

    const submitRes = await request(app.getHttpServer())
      .post(`/clients/${clientId}/content/${contentId}/submit`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ approverIds: [approverManagerId] })
      .expect(201);
    flowId = submitRes.body.id as string;
  });

  afterAll(async () => {
    await prisma.agency.delete({ where: { id: agencyId } }).catch(() => {});
    await app.close();
  });

  it('forbids a MANAGER who is not the named approver from reading the flow by id (AUTH-1)', async () => {
    await request(app.getHttpServer())
      .get(`/approvals/${flowId}`)
      .set('Authorization', `Bearer ${otherManagerToken}`)
      .expect(403);
  });

  it("excludes the flow from that same MANAGER's list view", async () => {
    const res = await request(app.getHttpServer())
      .get('/approvals')
      .set('Authorization', `Bearer ${otherManagerToken}`)
      .expect(200);
    expect((res.body as { id: string }[]).some((f) => f.id === flowId)).toBe(false);
  });

  it('allows the MANAGER who is the named approver to read the flow', async () => {
    const res = await request(app.getHttpServer())
      .get(`/approvals/${flowId}`)
      .set('Authorization', `Bearer ${approverManagerToken}`)
      .expect(200);
    expect(res.body.id).toBe(flowId);
  });
});
