import { api } from '@/lib/api';
import type { Campaign, MediaAsset } from '../types';

export function fetchMedia(clientId: string) {
  return api.get<MediaAsset[]>(`/clients/${clientId}/media`);
}

export function fetchCampaigns(clientId: string) {
  return api.get<Campaign[]>(`/clients/${clientId}/campaigns`);
}

export function generateImage(
  clientId: string,
  payload: { prompt: string; size: string; folder: string | undefined; campaignId: string | undefined },
) {
  return api.post<MediaAsset>(`/clients/${clientId}/media/generate-image`, payload);
}

export function deleteMedia(clientId: string, id: string) {
  return api.delete(`/clients/${clientId}/media/${id}`);
}
