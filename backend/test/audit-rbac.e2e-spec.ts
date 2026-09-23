import { afterAll, beforeAll, describe, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { Role } from './../src/generated/prisma/client.js';
import { bootstrapApp, cleanupAgency, createMember, e2eSuffix, registerAndVerify } from './support/e2e-helpers.js';

// AuditController: OWNER/ADMIN only. Also proves the FE-1 pagination fix (listForAgencyPaginated)
// is actually wired to GET /audit-logs — skip/take query params and the {items, total, skip,
// take} response shape, not just the hardcoded-100 array the endpoint used to return.
describe('Audit Log RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agencyId: string;
  let ownerToken: string;
  let managerToken: string;

  const suffix = e2eSuffix();
  const password = 'password12345';

  beforeAll(async () => {
    ({ app, prisma } = await bootstrapApp());

    const owner = await registerAndVerify(app, prisma, `E2E Audit Agency ${suffix}`, 'Owner', `owner-${suffix}@e2e.test`, password);
    ownerToken = owner.accessToken;
    agencyId = owner.agencyId;

    managerToken = await createMember(app, ownerToken, `manager-${suffix}@e2e.test`, 'Manager', Role.MANAGER, [], password);
  });

  afterAll(async () => {
    await cleanupAgency(prisma, agencyId);
    await app.close();
  });

  it('forbids a MANAGER from viewing the audit log', async () => {
    await request(app.getHttpServer())
      .get('/audit-logs')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(403);
  });

  it('allows the OWNER to view a paginated page of the audit log', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs?skip=0&take=5')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    if (!Array.isArray(res.body.items) || typeof res.body.total !== 'number') {
      throw new Error(`Expected {items, total, skip, take} shape, got: ${JSON.stringify(res.body)}`);
    }
    if (res.body.skip !== 0 || res.body.take !== 5) {
      throw new Error(`Expected skip=0/take=5 to be echoed back, got skip=${res.body.skip}/take=${res.body.take}`);
    }
  });
});
