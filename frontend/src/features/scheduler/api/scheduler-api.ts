import { api } from '@/lib/api';
import type { ContentItem, ScheduledPost } from '../types';

export function fetchApprovedContent(clientId: string) {
  return api.get<ContentItem[]>(`/clients/${clientId}/content?status=APPROVED`);
}

export function fetchScheduledPosts(clientId: string) {
  return api.get<ScheduledPost[]>(`/clients/${clientId}/scheduled-posts`);
}

export function fetchMediaAssets(clientId: string) {
  return api.get<{ id: string; fileName: string }[]>(`/clients/${clientId}/media`);
}

export function createDraft(
  clientId: string,
  payload: { type: string; body: string; mediaAssetId: string | undefined },
) {
  return api.post(`/clients/${clientId}/content`, payload);
}

export function scheduleContent(
  clientId: string,
  contentId: string,
  payload: { scheduledTime: string; platforms: string[] | undefined },
) {
  return api.post<ScheduledPost[]>(`/clients/${clientId}/content/${contentId}/schedule`, payload);
}

export function publishScheduledPost(postId: string) {
  return api.post(`/scheduled-posts/${postId}/publish`, {});
}

export function cancelScheduledPost(postId: string) {
  return api.delete(`/scheduled-posts/${postId}`);
}

export function rescheduleScheduledPost(postId: string, payload: { scheduledTime: string }) {
  return api.patch(`/scheduled-posts/${postId}`, payload);
}

export function retryScheduledPost(postId: string) {
  return api.post(`/scheduled-posts/${postId}/retry`, {});
}
