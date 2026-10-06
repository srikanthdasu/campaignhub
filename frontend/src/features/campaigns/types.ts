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

export const STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'] as const;

export const STATUS_TONE: Record<(typeof STATUSES)[number], 'neutral' | 'accent' | 'warning' | 'success'> = {
  DRAFT: 'neutral',
  ACTIVE: 'accent',
  PAUSED: 'warning',
  COMPLETED: 'success',
  ARCHIVED: 'neutral',
};

export const CONTENT_STATUS_TONE: Record<string, 'accent' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  DRAFT: 'neutral',
  IN_REVIEW: 'accent',
  CHANGES_REQUESTED: 'warning',
  APPROVED: 'success',
  SCHEDULED: 'accent',
  PUBLISHED: 'success',
  REJECTED: 'danger',
};

export interface Member {
  id: string;
  name: string;
}

export interface ContentIdea {
  label: string;
  done: boolean;
}

export interface CampaignSummary {
  id: string;
  name: string;
  objective: string | null;
  goal: string | null;
  kpi: string | null;
  target: number | null;
  platforms: (typeof PLATFORMS)[number][];
  contentIdeas: ContentIdea[] | null;
  assignedTo: Member | null;
  assignedToId: string | null;
  reviewer: Member | null;
  reviewerId: string | null;
  startDate: string | null;
  endDate: string | null;
  status: (typeof STATUSES)[number];
  _count: { contentItems: number; adCampaigns: number };
}

export interface CampaignContentItem {
  id: string;
  type: string;
  status: string;
  platforms: string[];
  body: string | null;
}

export interface CampaignDetail extends CampaignSummary {
  contentItems: CampaignContentItem[];
}
