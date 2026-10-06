import { api } from '@/lib/api';
import type { PLATFORMS, SocialAccount } from '../types';

export function fetchSocialAccounts(clientId: string) {
  return api.get<SocialAccount[]>(`/clients/${clientId}/social-accounts`);
}

export function getFacebookConnectUrl(clientId: string) {
  return api.get<{ url: string }>(`/clients/${clientId}/social-accounts/facebook/connect`);
}

export function getInstagramConnectUrl(clientId: string) {
  return api.get<{ url: string }>(`/clients/${clientId}/social-accounts/instagram/connect`);
}

export function getLinkedInConnectUrl(clientId: string) {
  return api.get<{ url: string }>(`/clients/${clientId}/social-accounts/linkedin/connect`);
}

export function getXConnectUrl(clientId: string) {
  return api.get<{ url: string }>(`/clients/${clientId}/social-accounts/x/connect`);
}

export function getYouTubeConnectUrl(clientId: string) {
  return api.get<{ url: string }>(`/clients/${clientId}/social-accounts/youtube/connect`);
}

export function connectWhatsApp(clientId: string, payload: { code: string; phoneNumberId: string }) {
  return api.post(`/clients/${clientId}/social-accounts/whatsapp/connect`, payload);
}

export function addSocialAccount(clientId: string, payload: { platform: (typeof PLATFORMS)[number]; label: string }) {
  return api.post(`/clients/${clientId}/social-accounts`, payload);
}

export function removeSocialAccount(clientId: string, id: string) {
  return api.delete(`/clients/${clientId}/social-accounts/${id}`);
}
