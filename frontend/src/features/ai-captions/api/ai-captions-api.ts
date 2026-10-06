import { api } from '@/lib/api';
import type { SavedCaption, Variant } from '../types';

export function fetchSavedCaptions(clientId: string) {
  return api.get<SavedCaption[]>(`/clients/${clientId}/ai-captions`);
}

export function generateCaptions(
  clientId: string,
  payload: { input: string; tone: string; platform: string | undefined },
) {
  return api.post<Variant[]>(`/clients/${clientId}/ai-captions/generate`, payload);
}

export function saveCaption(
  clientId: string,
  payload: {
    input: string;
    tone: string;
    platform: string | undefined;
    text: string;
    hashtags: string[];
  },
) {
  return api.post(`/clients/${clientId}/ai-captions`, payload);
}

export function deleteCaption(clientId: string, id: string) {
  return api.delete(`/clients/${clientId}/ai-captions/${id}`);
}
