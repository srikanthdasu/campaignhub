import { api } from '@/lib/api';
import type { Flow, ActivityEntry } from '../types';

export function fetchFlows() {
  return api.get<Flow[]>('/approvals');
}

export function fetchAuditLogs() {
  return api.get<ActivityEntry[]>('/audit-logs');
}

export function decideStep(
  flowId: string,
  stepId: string,
  payload: { decision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED'; comment: string | undefined },
) {
  return api.post(`/approvals/${flowId}/steps/${stepId}/decide`, payload);
}
