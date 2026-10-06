export interface AuditEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; role: string } | null;
}

export interface AuditPage {
  items: AuditEntry[];
  total: number;
  skip: number;
  take: number;
}

export const PAGE_SIZE = 50;

export const ACTION_TONE: Record<string, 'accent' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  LOGIN_SUCCESS: 'success',
  LOGIN_FAILED: 'danger',
  MEMBER_DEACTIVATED: 'warning',
  MEMBER_ACTIVATED: 'success',
  MEMBER_ROLE_CHANGED: 'accent',
};
