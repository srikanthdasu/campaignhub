import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { Role } from '../../src/generated/prisma/client.js';

// Shared boilerplate for RBAC-focused e2e specs — extracted from scheduler-rbac.e2e-spec.ts /
// approvals-rbac.e2e-spec.ts, which had this duplicated inline. Boots the real AppModule (no
// mocking) so guard/decorator wiring is exercised the way a service-only unit test can't.

export const E2E_PASSWORD = 'password12345';

export async function bootstrapApp(): Promise<{ app: INestApplication<App>; prisma: PrismaService }> {
  const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  const prisma = app.get(PrismaService);
  return { app, prisma };
}

// Unique per test run so parallel/repeated runs never collide on the same email/agency name.
export function e2eSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export async function login(app: INestApplication<App>, email: string, password = E2E_PASSWORD): Promise<string> {
  const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
  return res.body.accessToken as string;
}

// Registration requires clicking an emailed verification link (AuthService.register/verifyEmail)
// — bypassed here via a direct test-DB write, same as scheduler-rbac.e2e-spec.ts's own pattern.
export async function registerAndVerify(
  app: INestApplication<App>,
  prisma: PrismaService,
  agencyName: string,
  name: string,
  email: string,
  password = E2E_PASSWORD,
): Promise<{ accessToken: string; agencyId: string; userId: string }> {
  await request(app.getHttpServer())
    .post('/auth/register')
    .send({ agencyName, name, email, password })
    .expect(201);
  await prisma.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
  const accessToken = await login(app, email, password);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { accessToken, agencyId: user.agencyId as string, userId: user.id };
}

// Creates a member via the real POST /users route (as the Owner) and logs them in — exercises the
// same real create-then-grant-access path a production admin would use.
export async function createMember(
  app: INestApplication<App>,
  ownerToken: string,
  email: string,
  name: string,
  role: Role,
  clientIds: string[],
  password = E2E_PASSWORD,
): Promise<string> {
  await request(app.getHttpServer())
    .post('/users')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ email, name, password, role, clientIds })
    .expect(201);
  return login(app, email, password);
}

export async function createClient(app: INestApplication<App>, ownerToken: string, name: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/clients')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name })
    .expect(201);
  return res.body.id as string;
}

export async function cleanupAgency(prisma: PrismaService, agencyId: string): Promise<void> {
  await prisma.agency.delete({ where: { id: agencyId } }).catch(() => {});
}
