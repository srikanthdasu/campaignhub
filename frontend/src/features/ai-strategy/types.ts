export type Status = 'DRAFT' | 'GENERATED' | 'APPROVED' | 'REJECTED';

export interface StrategyRequest {
  id: string;
  title: string;
  goal: string | null;
  context: { note?: string } | null;
  output: string | null;
  status: Status;
  reviewNote: string | null;
  feedbackRating: number | null;
  updatedAt: string;
}

export const STATUS_TONE: Record<Status, 'neutral' | 'accent' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  GENERATED: 'accent',
  APPROVED: 'success',
  REJECTED: 'danger',
};

export const CAN_REVIEW_ROLES = ['OWNER', 'ADMIN', 'MANAGER'];
