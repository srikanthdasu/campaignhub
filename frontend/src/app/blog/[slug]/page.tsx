import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MarketingHeader } from '@/components/marketing-header';
import { MarketingFooter } from '@/components/marketing-footer';
import { BLOG_POSTS, getBlogPost } from '@/lib/blog-posts';
import { SITE_URL } from '@/lib/seo';

export async function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} — CampaignHub AI`,
    description: post.excerpt,
    alternates: { canonical: `${SITE_URL}/blog/${post.slug}` },
  };
}

function PostBody({ slug }: { slug: string }) {
  if (slug === 'cut-content-approval-time-in-half') {
    return (
      <>
        <p>
          Ask most agencies why an approval took four days and you&apos;ll hear some version of
          &quot;the client was slow.&quot; Sometimes that&apos;s true. But watch what actually
          happens in a typical approval cycle and the client is rarely the bottleneck — the
          bottleneck is that nobody, including the client, can tell what state a post is actually
          in.
        </p>
        <p>
          The draft went out in a WhatsApp message on Tuesday. Someone replied &quot;looks
          good&quot; but didn&apos;t say if that meant approved-to-publish or just
          approved-in-concept. The designer made a small edit Thursday and never re-sent it. By
          the following week, three people think it&apos;s ready, one thinks it&apos;s still
          waiting on the client, and nobody actually schedules it.
        </p>
        <h2>The fix isn&apos;t more meetings — it&apos;s a visible state</h2>
        <p>
          Every approval process that actually moves fast has one thing in common: at any moment,
          anyone involved can look at a piece of content and know exactly what state it&apos;s in
          — drafted, submitted, in review, changes requested, approved — without asking anyone.
          That single property removes almost all the back-and-forth, because the back-and-forth
          was never really about disagreement. It was about uncertainty.
        </p>
        <p>Three things make that state actually visible instead of theoretical:</p>
        <ul>
          <li>
            <strong>One thread per piece of content, not one thread per conversation.</strong>{' '}
            If feedback on a caption lives in a WhatsApp message, a comment on a shared doc, and
            an email reply, there is no single state — there are three partial ones. Route
            feedback back to the same object the content lives in.
          </li>
          <li>
            <strong>A submit action, not an implicit one.</strong> &quot;I sent it to them&quot;
            is not the same as &quot;it is now in review.&quot; A real submit step — one that
            actually changes what the client sees waiting for them — is what turns a vague
            hand-off into a countable one.
          </li>
          <li>
            <strong>Approve and reject are different from silence.</strong> If a client can
            ignore a request indefinitely with no visible consequence, some fraction of your
            content will sit forever. A visible &quot;pending your review since Tuesday&quot;
            does more to close that gap than a follow-up email ever will.
          </li>
        </ul>
        <p>
          This is exactly the problem CampaignHub AI&apos;s{' '}
          <Link href="/solutions/agencies" className="text-accent-300 hover:underline">
            approvals workflow
          </Link>{' '}
          is built around — not because approvals are hard to build, but because most tools treat
          them as a checkbox feature instead of the actual thing agencies lose the most time to.
        </p>
      </>
    );
  }

  if (slug === 'single-source-of-truth-for-client-content') {
    return (
      <>
        <p>
          Open five different agency laptops and you&apos;ll usually find the same client&apos;s
          content spread across five different combinations of tools: a shared Drive folder for
          assets, a spreadsheet for the posting calendar, a Slack channel for feedback, an email
          thread for the client&apos;s actual sign-off, and a scheduling tool that only the one
          person who set it up remembers how to use.
        </p>
        <p>
          None of these tools are individually bad. The problem is what happens between them.
          Every question — &quot;did the client approve this?&quot;, &quot;which version is the
          final one?&quot;, &quot;did this actually go out?&quot; — stops being a lookup and
          becomes a search. And a search across five tools takes minutes even when the answer is
          simple, which adds up to hours a week per account manager, invisible on any invoice.
        </p>
        <h2>The real cost isn&apos;t the tools — it&apos;s the seams between them</h2>
        <p>
          Consolidating tools isn&apos;t about minimalism for its own sake. It&apos;s about
          removing the seams where information quietly gets lost: the asset that got approved in
          Slack but never made it into the scheduling tool, the caption edit that happened after
          the client signed off on an earlier version, the post that&apos;s &quot;scheduled&quot;
          according to one person&apos;s memory and nowhere else.
        </p>
        <p>
          A single source of truth doesn&apos;t mean one tool does everything a marketer could
          ever need. It means that for a given piece of client content, there is exactly one place
          that reflects its actual current state — the copy, the asset, the approval status, and
          the schedule — and everyone involved, including the client, looks at that same place
          instead of reconstructing it from five different inboxes.
        </p>
        <p>
          That&apos;s the design behind CampaignHub AI&apos;s content planner: not a calendar that
          links out to where the real content lives, but the place the content actually lives —
          draft, approval, and schedule, in one record, per client.
        </p>
      </>
    );
  }

  return null;
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <MarketingHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-24 pt-8">
        <Link href="/blog" className="text-sm font-medium text-accent-300 hover:underline">
          ← Blog
        </Link>

        <article className="mt-6">
          <p className="text-xs text-neutral-500">
            {new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {' · '}
            {post.readMinutes} min read
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-balance text-neutral-50 sm:text-4xl">
            {post.title}
          </h1>

          <div className="prose-invert mt-8 space-y-4 text-[15px] leading-relaxed text-neutral-300 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-neutral-50 [&_li]:mt-2 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
            <PostBody slug={post.slug} />
          </div>
        </article>
      </main>

      <MarketingFooter />
    </div>
  );
}
