import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

// Everything under the authenticated app shell, and the client-portal's own separate
// authenticated area, is behind a login wall and has nothing useful to a crawler — disallowing
// it avoids wasting crawl budget on pages that just redirect to /login anyway.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/admin/',
        '/content-planner',
        '/campaigns',
        '/email-campaigns',
        '/ads',
        '/media-library',
        '/scheduler',
        '/social-accounts',
        '/ai-assistant',
        '/ai-captions',
        '/ai-image-studio',
        '/ai-strategy',
        '/ai-video-studio',
        '/analytics',
        '/approvals',
        '/billing',
        '/client-portal',
        '/profile',
        '/reports',
        '/settings',
        '/unified-inbox',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
