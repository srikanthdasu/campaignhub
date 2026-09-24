import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingHeader } from '@/components/marketing-header';
import { MarketingFooter } from '@/components/marketing-footer';
import { Sparkles, CalendarClock, ClipboardCheck, Bot } from 'lucide-react';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'CampaignHub AI for Freelance Marketers',
  description:
    'Plan, create, and schedule content for every client you manage — without paying for or learning a full agency-sized tool stack.',
  alternates: { canonical: `${SITE_URL}/solutions/freelancers` },
};

const POINTS = [
  {
    icon: ClipboardCheck,
    title: 'Every client in one calendar, not six tabs',
    body: 'Keep each client’s content plan separate and organized, without switching between separate logins or spreadsheets to remember what’s due when.',
  },
  {
    icon: Sparkles,
    title: 'AI that actually saves you time',
    body: 'Generate on-brand captions and visuals tuned to each client’s voice in seconds — real model calls, not a canned template swapped with their name.',
  },
  {
    icon: CalendarClock,
    title: 'Schedule it once, forget it',
    body: 'Queue posts across platforms and let CampaignHub AI publish on time — so a client’s content doesn’t depend on you remembering to hit publish at 9am.',
  },
  {
    icon: Bot,
    title: 'Client sign-off without the back-and-forth',
    body: 'Send drafts for approval and get a clear yes/no with comments, instead of a client editing your caption directly in a shared doc.',
  },
];

export default function FreelancersSolutionPage() {
  return (
    <div className="flex flex-1 flex-col">
      <MarketingHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 pb-24 pt-8">
        <div className="text-center">
          <span className="rounded-full border border-accent-400/30 bg-accent-500/15 px-3.5 py-1.5 text-xs font-medium uppercase tracking-wide text-accent-200">
            For freelance &amp; solo marketers
          </span>
          <h1 className="mt-4 text-4xl font-semibold text-balance text-neutral-50 sm:text-5xl">
            Manage every client&apos;s content like you had a whole team.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-neutral-400">
            You&apos;re the strategist, the writer, and the account manager. CampaignHub AI
            handles the planning, generation, scheduling, and approvals — so your time goes to
            the clients, not the busywork between them.
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
