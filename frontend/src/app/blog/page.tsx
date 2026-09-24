import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingHeader } from '@/components/marketing-header';
import { MarketingFooter } from '@/components/marketing-footer';
import { BLOG_POSTS } from '@/lib/blog-posts';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Blog — CampaignHub AI',
  description: 'Notes on running an agency, managing client content, and what we’re building.',
  alternates: { canonical: `${SITE_URL}/blog` },
};

export default function BlogIndexPage() {
  return (
    <div className="flex flex-1 flex-col">
      <MarketingHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-24 pt-8">
        <div className="text-center">
          <span className="rounded-full border border-accent-400/30 bg-accent-500/15 px-3.5 py-1.5 text-xs font-medium uppercase tracking-wide text-accent-200">
            Blog
          </span>
          <h1 className="mt-4 text-4xl font-semibold text-balance text-neutral-50">
            Notes on running an agency.
          </h1>
        </div>

        <div className="mt-14 space-y-4">
          {BLOG_POSTS.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="card-surface block rounded-2xl p-6 shadow-md transition-colors hover:border-white/20"
            >
              <p className="text-xs text-neutral-500">
                {new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                {' · '}
                {post.readMinutes} min read
              </p>
              <h2 className="mt-2 text-xl font-semibold text-neutral-50">{post.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">{post.excerpt}</p>
            </Link>
          ))}
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
