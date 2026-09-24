import type { Metadata } from 'next';
import { MarketingHeader } from '@/components/marketing-header';
import { MarketingFooter } from '@/components/marketing-footer';
import { CheckCircle2, Wrench, Lightbulb } from 'lucide-react';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Roadmap — CampaignHub AI',
  description: 'What’s live in CampaignHub AI today, what we’re actively building, and what we’re exploring next.',
  alternates: { canonical: `${SITE_URL}/roadmap` },
};

const LIVE = [
  'Content Planner — draft, tag, and organize every client’s posts in one calendar',
  'Approvals workflow — route content for sign-off before it goes live',
  'AI Captions & AI Image generation, tuned per client’s brand voice',
  'AI Assistant and AI Strategy, running on real model calls',
  'Scheduling & auto-publish, with real publishing to Instagram',
  'Unified inbox for messages and comments across connected platforms',
  'Analytics across clients and campaigns',
  'Role-based access — Owner, Admin, Manager, and per-client team access',
];

const IN_PROGRESS = [
  'Real publishing support for more platforms (Facebook, LinkedIn, X, YouTube, WhatsApp) — each one needs that platform’s own developer approval for write access, which we’re working through one at a time',
  'Automatic OAuth token refresh, so a connected account stays connected without needing to be reconnected by hand',
];

const EXPLORING = [
  'Deeper cross-client analytics and reporting exports',
  'More AI Strategy tooling for campaign planning',
  'Expanded AI Video Studio capabilities',
];

export default function RoadmapPage() {
  return (
    <div className="flex flex-1 flex-col">
      <MarketingHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-24 pt-8">
        <div className="text-center">
          <span className="rounded-full border border-accent-400/30 bg-accent-500/15 px-3.5 py-1.5 text-xs font-medium uppercase tracking-wide text-accent-200">
            Roadmap
          </span>
          <h1 className="mt-4 text-4xl font-semibold text-balance text-neutral-50">
            Where CampaignHub AI is heading.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-neutral-400">
            An honest, high-level look at what&apos;s live today, what we&apos;re actively building,
            and what we&apos;re exploring next. No fixed dates — this changes as we learn from
            real agencies using it.
          </p>
        </div>

        <div className="mt-16 space-y-12">
          <section>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" strokeWidth={1.8} />
              <h2 className="text-xl font-semibold text-neutral-50">Live now</h2>
            </div>
            <ul className="mt-4 space-y-3">
              {LIVE.map((item) => (
                <li key={item} className="card-surface rounded-xl p-4 text-sm leading-relaxed text-neutral-300">
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-2.5">
              <Wrench className="h-5 w-5 text-accent-300" strokeWidth={1.8} />
              <h2 className="text-xl font-semibold text-neutral-50">In progress</h2>
            </div>
            <ul className="mt-4 space-y-3">
              {IN_PROGRESS.map((item) => (
                <li key={item} className="card-surface rounded-xl p-4 text-sm leading-relaxed text-neutral-300">
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-2.5">
              <Lightbulb className="h-5 w-5 text-amber-300" strokeWidth={1.8} />
              <h2 className="text-xl font-semibold text-neutral-50">Exploring</h2>
            </div>
            <ul className="mt-4 space-y-3">
              {EXPLORING.map((item) => (
                <li key={item} className="card-surface rounded-xl p-4 text-sm leading-relaxed text-neutral-300">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="card-surface mt-16 flex flex-col items-center gap-3 rounded-2xl p-8 text-center">
          <h3 className="text-lg font-semibold text-neutral-50">Have a feature request?</h3>
          <p className="text-sm text-neutral-400">
            Reach out through <a href="/book-demo" className="text-accent-300 hover:underline">Book a demo</a> and tell us what you need — real agency feedback is what shapes this list.
          </p>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
