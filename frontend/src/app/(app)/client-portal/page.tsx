'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { useClientPicker } from '@/hooks/use-client-picker';
import { ClientPicker } from '@/components/client-picker';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import { ArrowRight } from 'lucide-react';

interface Agency {
  name: string;
  plan: string;
  subscriptionStatus: string;
}

interface CampaignSummary {
  id: string;
  name: string;
  status: string;
  goal: string | null;
  platforms: string[];
}

interface SocialAccount {
  id: string;
  platform: string;
  label: string;
}

interface Overview {
  approvals: { pending: number; approved: number; rejected: number };
  content: { byStatus: Record<string, number> };
}

export default function ClientPortalPage() {
  const { user } = useAuth();
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();
  const [agency, setAgency] = useState<Agency | null>(null);

  useEffect(() => {
    api.get<Agency>('/agencies/me').then(setAgency).catch(() => {});
  }, []);

  return (
    <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">
          Welcome{user ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-sm text-neutral-400">
          Your campaigns, approvals, and analytics — everything scoped to your account.
        </p>
      </motion.div>

      {clients && clients.length === 0 ? (
        <Card padding="lg">
          <p className="text-sm text-neutral-400">
            You don&apos;t have access to any client workspace yet — ask your agency to grant it.
          </p>
        </Card>
      ) : (
        <>
          {clients && clients.length > 1 && (
            <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
              <ClientPicker clients={clients} value={selectedClientId} onChange={setSelectedClientId} />
            </motion.div>
          )}

          {agency && (
            <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
              <Card padding="md" className="flex items-center justify-between">
                <p className="text-sm text-neutral-400">
                  Managed by <span className="text-neutral-200">{agency.name}</span>
                </p>
                <Badge tone="accent">{agency.plan} plan</Badge>
              </Card>
            </motion.div>
          )}

          {selectedClientId && <ClientPortalBody key={selectedClientId} clientId={selectedClientId} />}
        </>
      )}
    </motion.div>
  );
}

function ClientPortalBody({ clientId }: { clientId: string }) {
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[] | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    api.get<CampaignSummary[]>(`/clients/${clientId}/campaigns`).then(setCampaigns).catch(() => setCampaigns([]));
    api
      .get<SocialAccount[]>(`/clients/${clientId}/social-accounts`)
      .then(setSocialAccounts)
      .catch(() => setSocialAccounts([]));
    api
      .get<Overview>(`/clients/${clientId}/analytics/overview`)
      .then(setOverview)
      .catch(() => setOverview(null));
  }, [clientId]);

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      transition={{ duration: DURATION.base, ease: EASE_SOFT }}
      className="space-y-6"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Card padding="lg">
          <p className="text-sm text-neutral-400">Pending your review</p>
          <div className="mt-2 text-3xl font-semibold text-neutral-50">
            {overview ? overview.approvals.pending : <Skeleton className="h-9 w-12" />}
          </div>
          <Link href="/approvals" className="mt-2 inline-flex items-center gap-1 text-xs text-accent-300 hover:text-accent-200">
            Review now <ArrowRight className="h-3 w-3" />
          </Link>
        </Card>
        <Card padding="lg">
          <p className="text-sm text-neutral-400">Approved content</p>
          <div className="mt-2 text-3xl font-semibold text-neutral-50">
            {overview ? overview.approvals.approved : <Skeleton className="h-9 w-12" />}
          </div>
        </Card>
        <Card padding="lg">
          <p className="text-sm text-neutral-400">Connected accounts</p>
          <div className="mt-2 text-3xl font-semibold text-neutral-50">
            {socialAccounts ? socialAccounts.length : <Skeleton className="h-9 w-12" />}
          </div>
        </Card>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-50">Campaigns</h2>
          <Link href="/analytics" className="inline-flex items-center gap-1 text-xs text-accent-300 hover:text-accent-200">
            View analytics <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {campaigns === null ? (
          <Skeleton className="h-16 w-full rounded-2xl" />
        ) : campaigns.length === 0 ? (
          <Card padding="lg">
            <p className="text-sm text-neutral-400">No campaigns yet.</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {campaigns.map((c) => (
              <Card key={c.id} padding="md" className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-neutral-100">{c.name}</p>
                  <Badge tone="neutral">{c.status}</Badge>
                </div>
                {c.goal && <p className="text-xs text-neutral-400">{c.goal}</p>}
                <div className="flex flex-wrap gap-1">
                  {c.platforms.map((p) => (
                    <span key={p} className="text-[10px] text-neutral-500">
                      {p}
                    </span>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-neutral-50">Social accounts</h2>
        {socialAccounts === null ? (
          <Skeleton className="h-16 w-full rounded-2xl" />
        ) : socialAccounts.length === 0 ? (
          <Card padding="lg">
            <p className="text-sm text-neutral-400">No accounts connected yet.</p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {socialAccounts.map((a) => (
              <li key={a.id}>
                <Card padding="md" className="flex items-center gap-3">
                  <Badge tone="neutral">{a.platform}</Badge>
                  <span className="text-sm text-neutral-300">{a.label}</span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
