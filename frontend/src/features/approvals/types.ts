export const FLOW_TONE: Record<string, 'accent' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  SUBMITTED: 'accent',
  IN_REVIEW: 'accent',
  CHANGES_REQUESTED: 'warning',
  RE_SUBMITTED: 'accent',
  APPROVED: 'success',
  REJECTED: 'danger',
  COMPLETED: 'success',
};

export const UNRESOLVED_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'RE_SUBMITTED'];
export const STATUS_ORDER = ['SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'RE_SUBMITTED', 'APPROVED', 'REJECTED'] as const;

export interface Step {
  id: string;
  approverId: string | null;
  approver: { id: string; name: string } | null;
  stepOrder: number | null;
  decision: 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED';
  comment: string | null;
  decidedAt: string | null;
}

export interface Flow {
  id: string;
  mode: 'SEQUENTIAL' | 'PARALLEL';
  status: string;
  dueDate: string | null;
  createdAt: string;
  contentItem: {
    id: string;
    type: string;
    body: string | null;
    client: { name: string };
    campaign: { id: string; name: string } | null;
    createdBy: { id: string; name: string } | null;
    mediaAsset: { id: string; storageUrl: string; fileName: string } | null;
  };
  steps: Step[];
}

export interface ActivityEntry {
  id: string;
  action: string;
  entityType: string | null;
  createdAt: string;
  user: { id: string; name: string } | null;
}
