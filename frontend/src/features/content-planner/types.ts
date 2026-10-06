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

export const STATUS_TONE: Record<string, 'accent' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  DRAFT: 'neutral',
  IN_REVIEW: 'accent',
  CHANGES_REQUESTED: 'warning',
  APPROVED: 'success',
  SCHEDULED: 'accent',
  PUBLISHED: 'success',
  REJECTED: 'danger',
  FAILED: 'danger',
};

export interface ContentItem {
  id: string;
  type: (typeof CONTENT_TYPES)[number];
  body: string | null;
  platforms: string[];
  status: keyof typeof STATUS_TONE;
  createdAt: string;
  aiGenerated: boolean;
  mediaAsset: { id: string; fileName: string } | null;
}

export interface Member {
  id: string;
  name: string;
  role: string;
}

export interface MediaAssetOption {
  id: string;
  fileName: string;
  storageUrl: string;
}

export interface CaptionVariant {
  text: string;
  hashtags: string[];
}

export interface CampaignOption {
  id: string;
  name: string;
}
