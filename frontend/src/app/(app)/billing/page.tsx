'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import { Check } from 'lucide-react';

type Plan = 'STARTER' | 'GROWTH' | 'ENTERPRISE';
type SubStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | 'PAUSED';

interface PlanDefinition {
  plan: Plan;
  name: string;
  priceMonthlyInr: number | null;
  priceYearlyInr: number | null;
  features: string[];
}

interface Subscription {
  id: string;
  plan: Plan;
  status: SubStatus;
  billingCycle: 'MONTHLY' | 'YEARLY';
  currentPeriodEnd: string | null;
}

interface Invoice {
  id: string;
  amount: number;
  gstAmount: number;
  currency: string;
  status: string;
  issuedAt: string;
}

const STATUS_TONE: Record<SubStatus, 'neutral' | 'accent' | 'success' | 'warning' | 'danger'> = {
  TRIAL: 'accent',
  ACTIVE: 'success',
  PAST_DUE: 'warning',
  CANCELLED: 'danger',
  EXPIRED: 'danger',
  PAUSED: 'warning',
};

const VIEW_ROLES = ['OWNER', 'ADMIN'];

export default function BillingPage() {
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
    api.get<PlanDefinition[]>('/billing/plans').then(setPlans);
    if (canView) {
      api.get<Subscription | null>('/billing/subscription').then(setSubscription);
      api.get<Invoice[]>('/billing/invoices').then(setInvoices);
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
      await api.post('/billing/subscribe', { plan, billingCycle: cycle, gstNumber: gstNumber || undefined });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to subscribe');
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    setError(null);
    setBusy(true);
    try {
      await api.post('/billing/cancel');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to cancel');
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show" className="max-w-4xl space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Billing &amp; Subscriptions</h1>
        <p className="text-sm text-neutral-400">Simple plans. Secure payments. Seamless experience.</p>
        <p className="mt-2 text-xs text-amber-300/80">
          No Razorpay or Stripe credentials are configured yet, so checkout marks the
          subscription active without calling a real payment gateway. The plan record and GST
          invoice below are real and stored — only the charge itself is simulated.
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
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-neutral-500">
                    <tr>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Amount</th>
                      <th className="px-4 py-2.5">GST</th>
                      <th className="px-4 py-2.5">Total</th>
                      <th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-t border-white/5">
                        <td className="px-4 py-2.5 text-neutral-300">
                          {new Date(inv.issuedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2.5 text-neutral-300">
                          {inv.currency} {inv.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-2.5 text-neutral-300">
                          {inv.currency} {inv.gstAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-neutral-100">
                          {inv.currency} {(inv.amount + inv.gstAmount).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge tone={inv.status === 'PAID' ? 'success' : 'warning'}>{inv.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
