import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  ClipboardCheck,
  Sparkles,
  CalendarClock,
  CheckSquare,
  Inbox,
  BarChart3,
  Bot,
  Share2,
} from 'lucide-react';
import { AuthenticatedRedirect } from '@/components/authenticated-redirect';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'CampaignHub AI — Plan, Approve, and Publish Every Client Campaign',
  description:
    'CampaignHub AI is an AI-powered social media management platform for agencies — content planning, AI captions and images, approvals workflow, scheduling, and a unified inbox for every client, in one workspace. Built by SreeMa Tech Hub.',
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: 'CampaignHub AI — Plan, Approve, and Publish Every Client Campaign',
    description:
      'AI-powered social media management for agencies — content planning, approvals, scheduling, and AI-generated captions and images, all in one workspace.',
    images: [{ url: `${SITE_URL}/brand/logo-full.png` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CampaignHub AI — Plan, Approve, and Publish Every Client Campaign',
    description:
      'AI-powered social media management for agencies — content planning, approvals, scheduling, and AI-generated captions and images, all in one workspace.',
    images: [`${SITE_URL}/brand/logo-full.png`],
  },
};

const FEATURES = [
  {
    icon: ClipboardCheck,
    title: 'Content Planner',
    body: 'Draft, tag, and organize every client’s posts in one calendar view.',
  },
  {
    icon: Sparkles,
    title: 'AI Captions & Images',
    body: 'Generate on-brand captions and visuals in seconds, tuned per client’s voice.',
  },
  {
    icon: CheckSquare,
    title: 'Approvals Workflow',
    body: 'Route content for sign-off before it ever goes live — no more chasing approvals over chat.',
  },
  {
    icon: CalendarClock,
    title: 'Scheduling & Auto-Publish',
    body: 'Queue posts across platforms and let CampaignHub AI publish on time, every time.',
  },
  {
    icon: Inbox,
    title: 'Unified Inbox',
    body: 'Every client’s messages and comments, across every platform, in a single inbox.',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    body: 'See what’s working across clients and campaigns without exporting a single spreadsheet.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'CampaignHub AI',
  url: SITE_URL,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'AI-powered social media management platform for agencies — content planning, scheduling, approvals, and AI-generated captions and images.',
  publisher: {
    '@type': 'Organization',
    name: 'SreeMa Tech Hub',
    url: 'https://sreematechhub.com/',
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AuthenticatedRedirect />

      <div className="flex flex-1 flex-col">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2">
            <Image src="/brand/emblem.png" alt="" width={32} height={32} />
            <span className="text-lg font-semibold text-neutral-50">CampaignHub AI</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-neutral-300 hover:text-neutral-50">
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-accent-400 via-accent-500 to-fuchsia-500 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-accent-900/30 hover:shadow-lg hover:brightness-110"
            >
              Start free
            </Link>
          </nav>
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-24 px-6 pb-24 pt-8">
          <section className="flex flex-col items-center gap-6 text-center">
            <span className="rounded-full border border-accent-400/30 bg-accent-500/15 px-3.5 py-1.5 text-xs font-medium uppercase tracking-wide text-accent-200">
              Agency Command Center
            </span>
            <h1 className="max-w-3xl text-4xl font-semibold text-balance text-neutral-50 sm:text-5xl">
              Run every client campaign from one calm, connected workspace.
            </h1>
            <p className="max-w-xl text-lg text-neutral-400">
              Auth, roles, clients, approvals, publishing, and AI &mdash; built for agencies that
              manage many brands at once.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-accent-400 via-accent-500 to-fuchsia-500 px-6 py-3.5 text-base font-medium text-white shadow-md shadow-accent-900/30 hover:shadow-lg hover:brightness-110"
              >
                Start free
              </Link>
              <Link
                href="/login"
                className="card-surface inline-flex items-center justify-center rounded-xl px-6 py-3.5 text-base font-medium text-neutral-50 hover:border-white/20 hover:bg-white/[0.07]"
              >
                Sign in
              </Link>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card-surface rounded-2xl p-6 shadow-md">
                <f.icon className="h-6 w-6 text-accent-300" strokeWidth={1.8} />
                <h3 className="mt-4 text-base font-semibold text-neutral-50">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">{f.body}</p>
              </div>
            ))}
          </section>

          <section className="card-surface flex flex-col items-center gap-4 rounded-2xl p-10 text-center shadow-md">
            <Bot className="h-8 w-8 text-accent-300" strokeWidth={1.6} />
            <h2 className="text-2xl font-semibold text-neutral-50">
              Real AI, not a gimmick bolted on top.
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-neutral-400">
              AI Captions, AI Assistant, and AI Strategy run on real model calls — not canned
              responses — so the suggestions your team gets are actually useful.
            </p>
          </section>

          <section className="flex flex-col items-center gap-3 text-center">
            <Share2 className="h-6 w-6 text-neutral-400" strokeWidth={1.6} />
            <p className="text-sm text-neutral-400">
              Instagram, Facebook, LinkedIn, X, YouTube, TikTok, Pinterest, and WhatsApp &mdash;
              one workspace for every platform your clients are on.
            </p>
          </section>
        </main>

        <footer className="border-t border-white/10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              CampaignHub AI is built by{' '}
              <a
                href="https://sreematechhub.com/"
                target="_blank"
                rel="noopener"
                className="text-neutral-300 hover:text-neutral-50 hover:underline"
              >
                SreeMa Tech Hub
              </a>
              .
            </p>
            <div className="flex items-center gap-4">
              <a href="/terms" className="text-neutral-300 hover:text-neutral-50 hover:underline">
                Terms of Service
              </a>
              <a href="/privacy" className="text-neutral-300 hover:text-neutral-50 hover:underline">
                Privacy Policy
              </a>
              <p>&copy; {new Date().getFullYear()} SreeMa Tech Hub. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
