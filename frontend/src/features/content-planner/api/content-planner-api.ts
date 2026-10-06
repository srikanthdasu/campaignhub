import { api } from '@/lib/api';
import type { CampaignOption, CaptionVariant, ContentItem, MediaAssetOption, Member } from '../types';

export function fetchContent(clientId: string) {
  return api.get<ContentItem[]>(`/clients/${clientId}/content`);
}

export function fetchMediaAssets(clientId: string) {
  return api.get<MediaAssetOption[]>(`/clients/${clientId}/media`);
}

export function fetchClientAccess(clientId: string) {
  return api.get<Member[]>(`/clients/${clientId}/access`);
}

export function fetchCampaigns(clientId: string) {
  return api.get<CampaignOption[]>(`/clients/${clientId}/campaigns`);
}

export function generateCaptions(clientId: string, input: string, platform: string | undefined) {
  return api.post<CaptionVariant[]>(`/clients/${clientId}/ai-captions/generate`, { input, platform });
}

export function generateImage(clientId: string, prompt: string) {
  return api.post<MediaAssetOption>(`/clients/${clientId}/media/generate-image`, { prompt });
}

export function createContent(
  clientId: string,
  payload: {
    type: string;
    body: string;
    platforms: string[];
    mediaAssetId: string | undefined;
    campaignId: string | undefined;
    aiGenerated: boolean;
  },
) {
  return api.post(`/clients/${clientId}/content`, payload);
}

export function updateContent(
  clientId: string,
  id: string,
  payload: { body: string; platforms: string[]; mediaAssetId: string | undefined },
) {
  return api.patch(`/clients/${clientId}/content/${id}`, payload);
}

export function submitForApproval(
  clientId: string,
  id: string,
  payload: { approverIds: string[]; mode: 'SEQUENTIAL' | 'PARALLEL'; dueDate: string | undefined },
) {
  return api.post(`/clients/${clientId}/content/${id}/submit`, payload);
}

export function scheduleContent(
  clientId: string,
  id: string,
  payload: { scheduledTime: string; platforms: string[] | undefined },
) {
  return api.post<{ id: string }[]>(`/clients/${clientId}/content/${id}/schedule`, payload);
}

export function publishScheduledPost(postId: string) {
  return api.post(`/scheduled-posts/${postId}/publish`, {});
}
