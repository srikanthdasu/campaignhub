import { api } from '@/lib/api';
import type { StrategyRequest } from '../types';

export function fetchStrategyRequests(clientId: string) {
  return api.get<StrategyRequest[]>(`/clients/${clientId}/ai-strategy`);
}

export function fetchStrategyRequest(clientId: string, id: string) {
  return api.get<StrategyRequest>(`/clients/${clientId}/ai-strategy/${id}`);
}

export function createStrategyRequest(
  clientId: string,
  payload: { title: string; goal: string; contextNote: string },
) {
  return api.post<StrategyRequest>(`/clients/${clientId}/ai-strategy`, payload);
}

export function generateStrategy(clientId: string, id: string) {
  return api.post(`/clients/${clientId}/ai-strategy/${id}/generate`);
}

export function reviewStrategy(
  clientId: string,
  id: string,
  payload: { status: 'APPROVED' | 'REJECTED'; reviewNote: string },
) {
  return api.post(`/clients/${clientId}/ai-strategy/${id}/review`, payload);
}

export function submitFeedback(clientId: string, id: string, rating: number) {
  return api.post(`/clients/${clientId}/ai-strategy/${id}/feedback`, { rating });
}

export function deleteStrategyRequest(clientId: string, id: string) {
  return api.delete(`/clients/${clientId}/ai-strategy/${id}`);
}
