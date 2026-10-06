export type CampaignStatus = 'DRAFT' | 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED';
export type RecipientStatus = 'PENDING' | 'SENT' | 'FAILED' | 'UNSUBSCRIBED';

export const STATUS_TONE: Record<CampaignStatus, 'neutral' | 'accent' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  QUEUED: 'accent',
  SENDING: 'accent',
  SENT: 'success',
  FAILED: 'danger',
};

export const RECIPIENT_TONE: Record<RecipientStatus, 'neutral' | 'accent' | 'success' | 'danger'> = {
  PENDING: 'neutral',
  SENT: 'success',
  FAILED: 'danger',
  UNSUBSCRIBED: 'neutral',
};

export interface CampaignSummary {
  id: string;
  name: string;
  subject: string;
  status: CampaignStatus;
  _count: { recipients: number };
}

export interface Recipient {
  id: string;
  name: string;
  email: string;
  status: RecipientStatus;
  errorMessage: string | null;
}

export interface CampaignDetail extends Omit<CampaignSummary, '_count'> {
  bodyTemplate: string;
  recipients: Recipient[];
}
