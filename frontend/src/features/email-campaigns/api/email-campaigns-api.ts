import { api } from '@/lib/api';
import type { CampaignSummary, CampaignDetail } from '../types';

export function fetchCampaigns(clientId: string) {
  return api.get<CampaignSummary[]>(`/clients/${clientId}/email-campaigns`);
}

export function fetchCampaignDetail(clientId: string, id: string) {
  return api.get<CampaignDetail>(`/clients/${clientId}/email-campaigns/${id}`);
}

export function createCampaign(
  clientId: string,
  payload: { name: string; subject: string; bodyTemplate: string },
) {
  return api.post<CampaignDetail>(`/clients/${clientId}/email-campaigns`, payload);
}

export function importRecipientsBulk(
  clientId: string,
  id: string,
  payload: { recipients: { name: string; email: string }[] },
) {
  return api.post(`/clients/${clientId}/email-campaigns/${id}/recipients/bulk`, payload);
}

export function removeRecipient(clientId: string, id: string, recipientId: string) {
  return api.delete(`/clients/${clientId}/email-campaigns/${id}/recipients/${recipientId}`);
}

export function updateCampaignDetails(
  clientId: string,
  id: string,
  payload: { name: string; subject: string; bodyTemplate: string },
) {
  return api.patch(`/clients/${clientId}/email-campaigns/${id}`, payload);
}

export function sendCampaign(clientId: string, id: string) {
  return api.post(`/clients/${clientId}/email-campaigns/${id}/send`);
}
