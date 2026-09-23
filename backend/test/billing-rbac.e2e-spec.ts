import { afterAll, beforeAll, describe, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { InvoiceStatus, Role } from './../src/generated/prisma/client.js';
import {
  bootstrapApp,
  cleanupAgency,
  createMember,
  e2eSuffix,
  registerAndVerify,
} from './support/e2e-helpers.js';

// BillingController: subscription/invoice viewing is OWNER/ADMIN, but every mutating route
// (cancel, refund, void) is OWNER-only — real financial actions, not a routine admin task (see
// billing.controller.ts's own comment on refund/void). Doesn't call checkout/verify — those hit
// real Razorpay APIs, same reasoning the other e2e specs use to avoid external calls.
describe('Billing RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agencyId: string;
  let ownerToken: string;
  let adminToken: string;
  let invoiceId: string;

  const suffix = e2eSuffix();
  const password = 'password12345';

  beforeAll(async () => {
    ({ app, prisma } = await bootstrapApp());

    const owner = await registerAndVerify(app, prisma, `E2E Billing Agency ${suffix}`, 'Owner', `owner-${suffix}@e2e.test`, password);
    ownerToken = owner.accessToken;
    agencyId = owner.agencyId;

    adminToken = await createMember(app, ownerToken, `admin-${suffix}@e2e.test`, 'Admin', Role.ADMIN, [], password);

    const invoice = await prisma.invoice.create({
      data: { agencyId, amount: 999, gstAmount: 179.82, status: InvoiceStatus.PAID, paymentProviderRef: `pay_e2e_${suffix}` },
    });
    invoiceId = invoice.id;
  });

  afterAll(async () => {
    await prisma.invoice.deleteMany({ where: { agencyId } });
    await cleanupAgency(prisma, agencyId);
    await app.close();
  });

  it('allows an ADMIN to view invoices', async () => {
    await request(app.getHttpServer())
      .get('/billing/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('forbids an ADMIN from cancelling the subscription (OWNER-only)', async () => {
    await request(app.getHttpServer())
      .post('/billing/cancel')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });

  it('forbids an ADMIN from voiding an invoice (OWNER-only)', async () => {
    await request(app.getHttpServer())
      .post(`/billing/invoices/${invoiceId}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });

  it('forbids an ADMIN from refunding an invoice (OWNER-only)', async () => {
    await request(app.getHttpServer())
      .post(`/billing/invoices/${invoiceId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });

  it('allows the OWNER to void the invoice', async () => {
    await request(app.getHttpServer())
      .post(`/billing/invoices/${invoiceId}/void`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);
  });
});
