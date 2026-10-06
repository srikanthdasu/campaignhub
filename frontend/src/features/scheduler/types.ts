export const CONTENT_TYPES = ['CAPTION', 'IMAGE', 'VIDEO', 'POST'] as const;
export const PLATFORMS = [
  'INSTAGRAM',
  'FACEBOOK',
  'LINKEDIN',
  'X',
  'TIKTOK',
  'YOUTUBE',
  'PINTEREST',
  'WHATSAPP',
] as const;

export const POST_TONE: Record<string, 'accent' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  PENDING: 'accent',
  PUBLISHING: 'warning',
  PUBLISHED: 'success',
  FAILED: 'danger',
  CANCELLED: 'neutral',
};

export interface ContentItem {
  id: string;
  type: (typeof CONTENT_TYPES)[number];
  body: string | null;
  platforms: string[];
  status: string;
  mediaAsset: { id: string; fileName: string; storageUrl: string } | null;
}

export const MAX_RETRIES = 3;

// Only Instagram actually calls the platform's API today. For a post that hasn't published yet,
// this is just a forward-looking heads-up (nothing dishonest has happened); once a post reaches
// PUBLISHED, `post.simulated` below — set by the backend, not guessed here — is what actually
// distinguishes a real publish from a simulated one.
export const REAL_PUBLISH_PLATFORMS = new Set(['INSTAGRAM']);

export interface ScheduledPost {
  id: string;
  platform: string;
  scheduledTime: string;
  status: 'PENDING' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED' | 'CANCELLED';
  errorMessage: string | null;
  publishedAt: string | null;
  externalPostId: string | null;
  // True when this reached PUBLISHED with no real platform API call (every platform except
  // Instagram today) — backend-authoritative (SchedulerService.publishPost), not guessed here.
  simulated: boolean;
  retryCount: number;
  contentItem: { id: string; type: string; body: string | null };
}
