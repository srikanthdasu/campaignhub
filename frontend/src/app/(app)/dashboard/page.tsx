'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/auth-context';
import { ROLE_LABELS, Role, isAgencyAdmin } from '@/lib/roles';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { SocialConstellation } from '@/components/social-constellation';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import {
  Users,
  Share2,
  CalendarClock,
  ClipboardList,
  BarChart3,
  Plus,
  UserPlus,
  CalendarPlus,
  PenSquare,
  ClipboardCheck,
  Rocket,
  CreditCard,
} from 'lucide-react';

interface Agency {
  id: string;
  name: string;
  plan: string;
}

const REAL_PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'X', 'TIKTOK', 'YOUTUBE', 'PINTEREST', 'WHATSAPP'];

const POST_STATUS_META: { key: keyof Overview['posts']; label: string; color: string }[] = [
  { key: 'drafts', label: 'Drafts', color: '#a1a1aa' },
  { key: 'pendingApproval', label: 'Pending Approval', color: '#f59e0b' },
  { key: 'approved', label: 'Approved', color: '#22c55e' },
  { key: 'scheduled', label: 'Scheduled', color: '#0ea5e9' },
  { key: 'published', label: 'Published', color: '#8b5cf6' },
  { key: 'failed', label: 'Failed', color: '#ef4444' },
];

interface Overview {
  totalClients: number;
  connectedAccounts: number;
  posts: {
    drafts: number;
    pendingApproval: number;
    approved: number;
    scheduled: number;
    published: number;
    failed: number;
    rejected: number;
  };
  postsByPlatform: Record<string, number>;
  upcomingScheduledPosts: {
    id: string;
    platform: string;
    scheduledTime: string;
    body: string | null;
    type: string;
    clientName: string;
  }[];
  recentActivity: {
    id: string;
    action: string;
    entityType: string | null;
    createdAt: string;
    actorName: string | null;
  }[];
}

interface Subscription {
  plan: string;
  status: string;
  billingCycle: string;
  currentPeriodEnd: string | null;
}

function humanizeAction(action: string): string {
  return action
    .toLowerCase()
    .split('_')
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ');
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const WORKFLOW_STEPS = [
  { n: 1, title: 'Add Client', icon: UserPlus, color: '#6366f1', href: '/admin/agency' },
  { n: 2, title: 'Create Content', icon: PenSquare, color: '#8b5cf6', href: '/content-planner' },
  { n: 3, title: 'Connect Accounts', icon: Share2, color: '#0ea5e9', href: '/social-accounts' },
  { n: 4, title: 'Get Approval', icon: ClipboardCheck, color: '#f59e0b', href: '/approvals' },
  { n: 5, title: 'Schedule', icon: CalendarPlus, color: '#22c55e', href: '/scheduler' },
  { n: 6, title: 'Publish', icon: Rocket, color: '#d946ef', href: '/scheduler' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const admin = isAgencyAdmin(user?.role as Role | undefined);
  const isClient = user?.role === 'CLIENT';

  const [agency, setAgency] = useState<Agency | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null | undefined>(undefined);

  useEffect(() => {
    if (isClient) router.replace('/client-portal');
  }, [isClient, router]);

  useEffect(() => {
    if (isClient) return;
    api.get<Agency>('/agencies/me').then(setAgency).catch(() => {});
    api.get<Overview>('/dashboard/overview').then(setOverview).catch(() => {});
    if (admin) {
      api
        .get<unknown[]>('/users')
        .then((u) => setMemberCount(u.length))
        .catch(() => {});
      api
        .get<Subscription | null>('/billing/subscription')
        .then(setSubscription)
        .catch(() => setSubscription(null));
    }
  }, [admin, isClient]);

  if (isClient) return null;

  const posts = overview?.posts;
  const totalPosts = posts ? Object.values(posts).reduce((a, b) => a + b, 0) : 0;
  const maxPlatformCount = overview ? Math.max(1, ...Object.values(overview.postsByPlatform)) : 1;

  return (
    <motion.div variants={staggerContainer(0.06)} initial="hidden" animate="show" className="max-w-[1500px] space-y-6">
      <motion.div
        variants={fadeUp}
        transition={{ duration: DURATION.base, ease: EASE_SOFT }}
        className="card-surface relative overflow-hidden rounded-3xl p-8 shadow-lg sm:p-10"
      >
        <div className="absolute -right-2 -top-2 hidden sm:block">
          <SocialConstellation size="md" />
        </div>
        <div className="relative z-10 max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-300 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
            {agency?.name ?? 'Campaign Command Center'}
          </span>
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-neutral-50 sm:text-4xl">
            Welcome back<span className="gradient-text">{user ? `, ${user.name.split(' ')[0]}` : ''}</span>
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
            Here&apos;s what&apos;s happening across {agency?.name ?? 'your agency'} right now. You&apos;re signed in
            as {user ? ROLE_LABELS[user.role as Role] ?? user.role : '—'}.
          </p>
          <Link
            href="/content-planner"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-accent-500 to-fuchsia-500 px-4 py-2 text-sm font-medium text-white shadow-md hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Quick Create
          </Link>
        </div>
      </motion.div>

      <motion.div
        variants={fadeUp}
        transition={{ duration: DURATION.base, ease: EASE_SOFT }}
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6"
      >
        <StatCard label="Total Clients" value={overview?.totalClients ?? null} />
        <StatCard label="Connected Accounts" value={overview?.connectedAccounts ?? null} />
        <StatCard label="Scheduled Posts" value={overview?.posts.scheduled ?? null} />
        <StatCard label="Published Posts" value={overview?.posts.published ?? null} />
        <StatCard label="Pending Approvals" value={overview?.posts.pendingApproval ?? null} />
        {admin ? (
          <StatCard label="Team Members" value={memberCount} />
        ) : (
          <Card padding="lg">
            <p className="text-sm text-neutral-400">Your role</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-50">
              {user ? ROLE_LABELS[user.role as Role] ?? user.role : '—'}
            </p>
          </Card>
        )}
      </motion.div>

      <motion.div
        variants={fadeUp}
        transition={{ duration: DURATION.base, ease: EASE_SOFT }}
        className="grid grid-cols-1 gap-4 lg:grid-cols-3"
      >
        {/* Posts Overview */}
        <Card padding="lg">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-accent-300" />
            <h2 className="text-sm font-semibold text-neutral-50">Posts Overview</h2>
          </div>
          {!overview ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <ul className="space-y-2 text-xs">
              {POST_STATUS_META.map((m) => (
                <li key={m.key} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-neutral-400">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                    {m.label}
                  </span>
                  <span className="font-medium text-neutral-100">{posts?.[m.key] ?? 0}</span>
                </li>
              ))}
              <li className="flex items-center justify-between border-t border-white/10 pt-2 font-semibold text-neutral-100">
                <span>Total Posts</span>
                <span>{totalPosts}</span>
              </li>
            </ul>
          )}
        </Card>

        {/* Posts by Platform */}
        <Card padding="lg">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-accent-300" />
            <h2 className="text-sm font-semibold text-neutral-50">Posts by Platform</h2>
          </div>
          {!overview ? (
            <Skeleton className="h-32 w-full" />
          ) : Object.keys(overview.postsByPlatform).length === 0 ? (
            <p className="text-xs text-neutral-500">Nothing scheduled or published yet.</p>
          ) : (
            <ul className="space-y-2">
              {REAL_PLATFORMS.filter((p) => overview.postsByPlatform[p]).map((p) => (
                <li key={p} className="text-xs">
                  <div className="mb-0.5 flex items-center justify-between text-neutral-400">
                    <span>{p}</span>
                    <span className="font-medium text-neutral-100">{overview.postsByPlatform[p]}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/[0.06]">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-accent-500 to-fuchsia-500"
                      style={{ width: `${(overview.postsByPlatform[p] / maxPlatformCount) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Recent Activity */}
        <Card padding="lg">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-accent-300" />
            <h2 className="text-sm font-semibold text-neutral-50">Recent Activity</h2>
          </div>
          {!overview ? (
            <Skeleton className="h-32 w-full" />
          ) : overview.recentActivity.length === 0 ? (
            <p className="text-xs text-neutral-500">Nothing yet.</p>
          ) : (
            <ul className="max-h-56 space-y-2.5 overflow-y-auto text-xs">
              {overview.recentActivity.map((a) => (
                <li key={a.id}>
                  <p className="text-neutral-300">
                    {humanizeAction(a.action)}
                    {a.actorName && <span className="text-neutral-500"> · {a.actorName}</span>}
                  </p>
                  <p className="text-[11px] text-neutral-500">{timeAgo(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </motion.div>

      <motion.div
        variants={fadeUp}
        transition={{ duration: DURATION.base, ease: EASE_SOFT }}
        className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        {/* Upcoming Scheduled Posts */}
        <Card padding="lg">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-accent-300" />
              <h2 className="text-sm font-semibold text-neutral-50">Upcoming Scheduled Posts</h2>
            </div>
            <Link href="/scheduler" className="text-xs font-medium text-accent-300 hover:underline">
              View Calendar →
            </Link>
          </div>
          {!overview ? (
            <Skeleton className="h-32 w-full" />
          ) : overview.upcomingScheduledPosts.length === 0 ? (
            <p className="text-xs text-neutral-500">Nothing scheduled yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {overview.upcomingScheduledPosts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate text-neutral-200">{p.body || p.type}</p>
                    <p className="text-[11px] text-neutral-500">
                      {p.clientName} · {new Date(p.scheduledTime).toLocaleString()}
                    </p>
                  </div>
                  <Badge tone="neutral">{p.platform}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Subscription Overview */}
        <Card padding="lg">
          <div className="mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-accent-300" />
            <h2 className="text-sm font-semibold text-neutral-50">Subscription</h2>
          </div>
          {!admin ? (
            <p className="text-xs text-neutral-500">Only Owners and Admins can view billing.</p>
          ) : subscription === undefined ? (
            <Skeleton className="h-24 w-full" />
          ) : subscription === null ? (
            <div className="space-y-2 text-xs text-neutral-400">
              <p>No active subscription yet.</p>
              <Link href="/billing" className="font-medium text-accent-300 hover:underline">
                View plans →
              </Link>
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-neutral-100">{subscription.plan}</span>
                <Badge tone={subscription.status === 'ACTIVE' ? 'success' : 'warning'}>{subscription.status}</Badge>
              </div>
              <p className="text-neutral-400">Billing cycle: {subscription.billingCycle}</p>
              {subscription.currentPeriodEnd && (
                <p className="text-neutral-400">
                  Renews: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-2">
                <div>
                  <p className="text-neutral-500">Team members</p>
                  <p className="font-semibold text-neutral-100">{memberCount ?? '—'}</p>
                </div>
                <div>
                  <p className="text-neutral-500">Clients</p>
                  <p className="font-semibold text-neutral-100">{overview?.totalClients ?? '—'}</p>
                </div>
              </div>
              <Link href="/billing" className="inline-block font-medium text-accent-300 hover:underline">
                Manage billing →
              </Link>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Quick workflow navigation */}
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h2 className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Campaign Workflow
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {WORKFLOW_STEPS.map((step, i) => (
            <div key={step.n} className="flex items-center gap-2">
              <Link
                href={step.href}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-center hover:border-white/20 hover:bg-white/[0.06]"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${step.color}22`, color: step.color }}
                >
                  <step.icon className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-medium text-neutral-300">{step.title}</span>
              </Link>
              {i < WORKFLOW_STEPS.length - 1 && <span className="text-neutral-600">→</span>}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Supported platforms */}
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <Card padding="lg">
          <div className="mb-2 flex items-center gap-2">
            <Users className="h-4 w-4 text-accent-300" />
            <h2 className="text-sm font-semibold text-neutral-50">Supported Platforms</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {REAL_PLATFORMS.map((p) => (
              <Badge key={p} tone="neutral">
                {p}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-neutral-500">
            Instagram, Facebook, LinkedIn, X, YouTube, and WhatsApp connect via real login. TikTok
            and Pinterest are added manually until their developer apps are registered.
          </p>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function StatCard({ label, value }: { label: string; value: number | null }) {
  return (
    <Card padding="lg" hoverable>
      <p className="text-xs text-neutral-400">{label}</p>
      <div className="mt-2 text-2xl font-semibold text-neutral-50 sm:text-3xl">
        {value === null ? <Skeleton className="h-9 w-16" /> : <AnimatedNumber value={value} />}
      </div>
    </Card>
  );
}
