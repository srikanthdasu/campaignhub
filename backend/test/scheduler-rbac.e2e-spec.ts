import { afterAll, beforeAll, describe, it } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { ContentStatus, Role } from './../src/generated/prisma/client.js';

// Exercises the scheduler RBAC fix (reschedule/cancel/publish previously had no @Roles check)
// end-to-end through the real HTTP/guard stack, since that's decorator-level behavior a
// service-only unit test can't observe. See scheduler.controller.ts.
describe('Scheduler RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agencyId: string;
  let ownerToken: string;
  let managerToken: string;
  let clientRoleToken: string;
  let scheduledPostId: string;

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const ownerEmail = `owner-${suffix}@e2e.test`;
  const managerEmail = `manager-${suffix}@e2e.test`;
  const clientEmail = `client-${suffix}@e2e.test`;
  const password = 'password12345';

  async function register(agencyName: string, name: string, email: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ agencyName, name, email, password })
      .expect(201);
    return res.body as { accessToken: string; user: { agencyId: string } };
  }

  async function login(email: string) {
    const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const owner = await register(`E2E Scheduler Agency ${suffix}`, 'Owner', ownerEmail);
    ownerToken = owner.accessToken;
    agencyId = owner.user.agencyId;

    const clientRes = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: `E2E Client ${suffix}` })
      .expect(201);
    const clientId = clientRes.body.id as string;

    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: managerEmail, name: 'Manager', password, role: Role.MANAGER, clientIds: [clientId] })
      .expect(201);
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: clientEmail, name: 'Client User', password, role: Role.CLIENT, clientIds: [clientId] })
      .expect(201);

    managerToken = await login(managerEmail);
    clientRoleToken = await login(clientEmail);

    const contentRes = await request(app.getHttpServer())
      .post(`/clients/${clientId}/content`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ type: 'POST', body: 'E2E test content', platforms: ['INSTAGRAM'] })
      .expect(201);
    const contentId = contentRes.body.id as string;

    // Skip the full approval workflow — this test is only exercising scheduler RBAC.
    await prisma.contentItem.update({ where: { id: contentId }, data: { status: ContentStatus.APPROVED } });

    const scheduleRes = await request(app.getHttpServer())
      .post(`/clients/${clientId}/content/${contentId}/schedule`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ scheduledTime: new Date(Date.now() + 86_400_000).toISOString() })
      .expect(201);
    scheduledPostId = scheduleRes.body[0].id as string;
  });

  afterAll(async () => {
    await prisma.agency.delete({ where: { id: agencyId } }).catch(() => {});
    await app.close();
  });

  it('forbids a CLIENT-role user from rescheduling', async () => {
    await request(app.getHttpServer())
      .patch(`/scheduled-posts/${scheduledPostId}`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .send({ scheduledTime: new Date(Date.now() + 172_800_000).toISOString() })
      .expect(403);
  });

  it('forbids a CLIENT-role user from cancelling', async () => {
    await request(app.getHttpServer())
      .delete(`/scheduled-posts/${scheduledPostId}`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .expect(403);
  });

  it('forbids a CLIENT-role user from force-publishing', async () => {
    await request(app.getHttpServer())
      .post(`/scheduled-posts/${scheduledPostId}/publish`)
      .set('Authorization', `Bearer ${clientRoleToken}`)
      .expect(403);
  });

  it('allows a MANAGER to reschedule', async () => {
    await request(app.getHttpServer())
      .patch(`/scheduled-posts/${scheduledPostId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ scheduledTime: new Date(Date.now() + 172_800_000).toISOString() })
      .expect(200);
  });
});
