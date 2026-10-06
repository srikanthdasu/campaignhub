import { api } from '@/lib/api';

export function fetchContentReport(clientId: string) {
  return api.get<{ id: string; type: string; status: string; platforms: string[]; createdAt: string }[]>(
    `/clients/${clientId}/content`,
  );
}

export function fetchCampaignsReport(clientId: string) {
  return api.get<
    { id: string; name: string; status: string; goal: string | null; kpi: string | null; target: number | null; platforms: string[] }[]
  >(`/clients/${clientId}/campaigns`);
}

export function fetchAdsReport(clientId: string) {
  return api.get<
    { id: string; name: string; platform: string; status: string; budgetAmount: number | null; budgetCurrency: string }[]
  >(`/clients/${clientId}/ads`);
}

export function fetchApprovalsReport() {
  return api.get<
    { id: string; mode: string; status: string; createdAt: string; contentItem: { clientId: string; type: string } }[]
  >('/approvals');
}
