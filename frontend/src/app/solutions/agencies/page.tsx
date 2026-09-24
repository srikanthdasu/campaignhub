import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingHeader } from '@/components/marketing-header';
import { MarketingFooter } from '@/components/marketing-footer';
import { Users, CheckSquare, Inbox, BarChart3 } from 'lucide-react';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'CampaignHub AI for Marketing Agencies',
  description:
    'Run every client campaign from one workspace — content planning, approvals, scheduling, and AI content generation for agencies managing multiple brands.',
  alternates: { canonical: `${SITE_URL}/solutions/agencies` },
};

const POINTS = [
  {
    icon: Users,
    title: 'One workspace, every client',
    body: 'Stop juggling separate logins, spreadsheets, and Slack threads per client. Content, approvals, schedules, and messages all live in one place, scoped by client access.',
  },
  {
    icon: CheckSquare,
    title: 'Approvals that don’t depend on chasing people',
    body: 'Route drafts to the right approver — client or internal — and see exactly where each post is stuck, instead of hunting through email for a sign-off.',
  },
  {
    icon: Inbox,
    title: 'A team that can actually share the load',
    body: 'Give managers, creators, and designers exactly the access they need per client — nobody sees an account they’re not assigned to, and nobody’s waiting on the one person who can log in.',
  },
  {
    icon: BarChart3,
    title: 'Reporting your clients will actually read',
    body: 'See what’s working across every client and campaign without exporting a spreadsheet for each one first.',
  },
];

export default function AgenciesSolutionPage() {
  return (
    <div className="flex flex-1 flex-col">
      <MarketingHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 pb-24 pt-8">
        <div className="text-center">
          <span className="rounded-full border border-accent-400/30 bg-accent-500/15 px-3.5 py-1.5 text-xs font-medium uppercase tracking-wide text-accent-200">
            For agencies
          </span>
          <h1 className="mt-4 text-4xl font-semibold text-balance text-neutral-50 sm:text-5xl">
            Run every client campaign from one calm, connected workspace.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-neutral-400">
            Built for the specific chaos of managing content for many clients at once — not a
            single-brand tool with a client picker bolted on.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-accent-400 via-accent-500 to-fuchsia-500 px-6 py-3.5 text-base font-medium text-white shadow-md shadow-accent-900/30 hover:shadow-lg hover:brightness-110"
            >
              Start free
            </Link>
            <Link
              href="/book-demo"
              className="card-surface inline-flex items-center justify-center rounded-xl px-6 py-3.5 text-base font-medium text-neutral-50 hover:border-white/20 hover:bg-white/[0.07]"
            >
              Book a demo
            </Link>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {POINTS.map((p) => (
            <div key={p.title} className="card-surface rounded-2xl p-6 shadow-md">
              <p.icon className="h-6 w-6 text-accent-300" strokeWidth={1.8} />
              <h3 className="mt-4 text-base font-semibold text-neutral-50">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">{p.body}</p>
            </div>
          ))}
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
