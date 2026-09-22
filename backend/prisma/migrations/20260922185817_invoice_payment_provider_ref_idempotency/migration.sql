-- BILL-2: the only duplicate-payment guard was Subscription.paymentProviderRef, a single
-- last-write-wins field checked only on the webhook path — not a real ledger, and not applied to
-- confirmSubscription at all, so a double-submit or a race between the two paths could create
-- two Invoice rows and double-extend the billing period for one payment.
ALTER TABLE "invoices" ADD COLUMN "payment_provider_ref" TEXT;
CREATE UNIQUE INDEX "invoices_payment_provider_ref_key" ON "invoices"("payment_provider_ref");
