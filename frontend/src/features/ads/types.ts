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

export const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP'] as const;

export const STEPS = [
  { key: 'BRIEF', label: 'Brief' },
  { key: 'AUDIENCE_BUDGET', label: 'Audience / Budget' },
  { key: 'CREATIVE', label: 'Creative' },
  { key: 'APPROVAL', label: 'Approval' },
  { key: 'LAUNCH', label: 'Launch' },
] as const;
export type StepKey = (typeof STEPS)[number]['key'];

export type Status = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'LAUNCHED' | 'PAUSED' | 'COMPLETED';

export const STATUS_TONE: Record<Status, 'neutral' | 'accent' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'accent',
  APPROVED: 'success',
  REJECTED: 'danger',
  LAUNCHED: 'success',
  PAUSED: 'warning',
  COMPLETED: 'neutral',
};

export const CAN_APPROVE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'];
export const EDITABLE_STATUSES: Status[] = ['DRAFT', 'REJECTED'];

export interface AdCampaign {
  id: string;
  name: string;
  objective: string | null;
  platform: (typeof PLATFORMS)[number];
  audienceNotes: string | null;
  budgetAmount: number | null;
  budgetCurrency: string;
  creativeText: string | null;
  status: Status;
  approvedAt: string | null;
  launchedAt: string | null;
  updatedAt: string;
}
