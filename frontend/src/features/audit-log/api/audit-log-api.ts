import { api } from '@/lib/api';
import type { AuditPage } from '../types';

export function fetchAuditLog(skip: number, take: number) {
  return api.get<AuditPage>(`/audit-logs?skip=${skip}&take=${take}`);
}
