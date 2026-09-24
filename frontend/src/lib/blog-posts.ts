export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string; // ISO date
  readMinutes: number;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'cut-content-approval-time-in-half',
    title: 'How to Cut Content Approval Time in Half (Without More Meetings)',
    excerpt:
      'Most approval delays aren’t about the client being slow — they’re about the process having no visible state. Here’s what actually fixes it.',
    date: '2026-09-20',
    readMinutes: 5,
  },
  {
    slug: 'single-source-of-truth-for-client-content',
    title: 'Why Every Agency Needs a Single Source of Truth for Client Content',
    excerpt:
      'When a client’s content lives across five tools, the real cost isn’t the tools — it’s every question turning into a search.',
    date: '2026-09-12',
    readMinutes: 4,
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
