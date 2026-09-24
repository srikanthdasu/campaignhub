import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { BLOG_POSTS } from '@/lib/blog-posts';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/login`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/register`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/solutions/agencies`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/solutions/freelancers`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/roadmap`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/book-demo`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/blog`, changeFrequency: 'weekly', priority: 0.6 },
    ...BLOG_POSTS.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];
}
