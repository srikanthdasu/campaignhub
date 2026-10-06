'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table } from '@/components/ui/table';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import { RequireRole } from '@/components/require-role';
import { Role } from '@/lib/roles';
import { Check } from 'lucide-react';
import type { Invoice, Plan, PlanDefinition, Subscription } from './types';
import { INVOICE_STATUS_TONE, STATUS_TONE, VIEW_ROLES } from './types';
import { loadRazorpayScript } from './razorpay';
import {
  cancelSubscription,
  createCheckout,
  fetchInvoices,
  fetchPlans,
  fetchSubscription,
  refundInvoice,
  verifyCheckout,
  voidInvoice,
} from './api/billing-api';

export function BillingPage() {
  return (
    <RequireRole roles={['OWNER', 'ADMIN', 'SUPER_ADMIN']}>
      <BillingPageContent />
    </RequireRole>
  );
}

function BillingPageContent() {
  const { user } = useAuth();
  const canView = !!user && VIEW_ROLES.includes(user.role);
  const canManage = user?.role === 'OWNER';

  const [plans, setPlans] = useState<PlanDefinition[] | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [cycle, setCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [gstNumber, setGstNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchPlans().then(setPlans);
    if (canView) {
      fetchSubscription().then(setSubscription);
      fetchInvoices().then(setInvoices);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubscribe(plan: Plan) {
    setError(null);
    setBusy(true);
    try {
      const order = await createCheckout({ plan, billingCycle: cycle, gstNumber: gstNumber || undefined });
      await loadRazorpayScript();

      const razorpay = new window.Razorpay({
        key: order.keyId,
        amount: order.amount * 100,
        currency: order.currency,
        name: 'CampaignHub AI',
        description: `${plan} — ${cycle === 'MONTHLY' ? 'Monthly' : 'Yearly'} subscription`,
        order_id: order.orderId,
        prefill: { name: user?.name, email: user?.email },
        theme: { color: '#5b63f5' },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (response) => {
          try {
            await verifyCheckout({
              plan,
              billingCycle: cycle,
              gstNumber: gstNumber || undefined,
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            load();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Payment succeeded but activation failed — contact support');
          } finally {
            setBusy(false);
          }
        },
      });
      razorpay.open();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start checkout');
      setBusy(false);
    }
  }

  async function onCancel() {
    setError(null);
    setBusy(true);
    try {
      await cancelSubscription();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to cancel');
    } finally {
      setBusy(false);
    }
  }

  async function onRefundInvoice(id: string) {
    setError(null);
    try {
      await refundInvoice(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to refund invoice');
    }
  }

  async function onVoidInvoice(id: string) {
    setError(null);
    try {
      await voidInvoice(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to void invoice');
    }
  }

  return (
    <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show" className="max-w-4xl space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Billing &amp; Subscriptions</h1>
        <p className="text-sm text-neutral-400">Simple plans. Secure payments. Seamless experience.</p>
        <p className="mt-2 text-xs text-amber-300/80">
          Checkout runs through Razorpay in test mode — use a test card, no real money moves.
          Every plan record, invoice, and payment ID below is real.
        </p>
      </motion.div>

      {!canView ? (
        <Card padding="lg">
          <p className="text-sm text-neutral-400">
            Billing is managed by your agency&apos;s Owner or Admin.
          </p>
        </Card>
      ) : (
        <>
          {error && (
            <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
              {error}
            </p>
          )}

          {subscription && (
            <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
              <Card padding="lg" className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-400">Current plan</p>
                  <p className="text-lg font-semibold text-neutral-50">
                    {subscription.plan} · {subscription.billingCycle}
                  </p>
                  {subscription.currentPeriodEnd && (
                    <p className="text-xs text-neutral-500">
                      Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={STATUS_TONE[subscription.status]}>{subscription.status}</Badge>
                  {canManage && subscription.status === 'ACTIVE' && (
                    <Button size="sm" variant="secondary" onClick={onCancel} loading={busy}>
                      Cancel
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

          {canManage && (
            <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
              <div className="mb-4 flex items-center gap-3">
                <div className="inline-flex rounded-xl border border-white/12 bg-white/[0.04] p-1">
                  {(['MONTHLY', 'YEARLY'] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCycle(c)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        cycle === c ? 'bg-accent-500/20 text-accent-200' : 'text-neutral-400'
                      }`}
                    >
                      {c === 'MONTHLY' ? 'Monthly' : 'Yearly'}
                    </button>
                  ))}
                </div>
                <input
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  placeholder="GST number (optional)"
                  className="rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-xs text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {plans?.map((p) => {
                  const price = cycle === 'MONTHLY' ? p.priceMonthlyInr : p.priceYearlyInr;
                  const isCurrent = subscription?.plan === p.plan && subscription.status === 'ACTIVE';
                  return (
                    <Card key={p.plan} padding="lg" className="flex flex-col gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-50">{p.name}</h3>
                        <p className="mt-1 text-2xl font-bold text-neutral-50">
                          {price === null ? 'Custom' : `₹${price.toLocaleString('en-IN')}`}
                          {price !== null && (
                            <span className="text-xs font-normal text-neutral-500">
                              /{cycle === 'MONTHLY' ? 'mo' : 'yr'}
                            </span>
                          )}
                        </p>
                      </div>
                      <ul className="flex-1 space-y-1.5">
                        {p.features.map((f) => (
                          <li key={f} className="flex items-start gap-1.5 text-xs text-neutral-400">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <Button
                        size="sm"
                        variant={isCurrent ? 'secondary' : 'primary'}
                        disabled={price === null || isCurrent}
                        loading={busy}
                        onClick={() => onSubscribe(p.plan)}
                      >
                        {price === null ? 'Contact Sales' : isCurrent ? 'Current Plan' : 'Choose Plan'}
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </motion.div>
          )}

          <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
            <h2 className="mb-3 text-sm font-semibold text-neutral-50">Invoices</h2>
            {invoices === null ? (
              <p className="text-sm text-neutral-400">Loading…</p>
            ) : invoices.length === 0 ? (
              <Card padding="lg">
                <p className="text-sm text-neutral-400">No invoices yet.</p>
              </Card>
            ) : (
              <Table
                rowKey={(inv) => inv.id}
                rows={invoices}
                columns={[
                  { key: 'date', header: 'Date', render: (inv) => new Date(inv.issuedAt).toLocaleDateString() },
                  { key: 'amount', header: 'Amount', render: (inv) => `${inv.currency} ${inv.amount.toLocaleString('en-IN')}` },
                  { key: 'gst', header: 'GST', render: (inv) => `${inv.currency} ${inv.gstAmount.toLocaleString('en-IN')}` },
                  {
                    key: 'total',
                    header: 'Total',
                    className: 'font-medium text-neutral-100',
                    render: (inv) => `${inv.currency} ${(inv.amount + inv.gstAmount).toLocaleString('en-IN')}`,
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (inv) => <Badge tone={INVOICE_STATUS_TONE[inv.status] ?? 'neutral'}>{inv.status}</Badge>,
                  },
                  ...(canManage
                    ? [
                        {
                          key: 'actions',
                          header: '',
                          render: (inv: Invoice) =>
                            inv.status === 'PAID' ? (
                              <div className="flex justify-end gap-2">
                                <ConfirmButton size="sm" onConfirm={() => onRefundInvoice(inv.id)}>
                                  Refund
                                </ConfirmButton>
                                <ConfirmButton size="sm" onConfirm={() => onVoidInvoice(inv.id)}>
                                  Void
                                </ConfirmButton>
                              </div>
                            ) : null,
                          className: 'text-right',
                        },
                      ]
                    : []),
                ]}
              />
            )}
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
