import { api } from '@/lib/api';
import type { BrandKit, Client, DeletedClient, Member } from '../types';

export function fetchClients() {
  return api.get<Client[]>('/clients');
}

export function fetchUsers() {
  return api.get<Member[]>('/users');
}

export function fetchClientAccess(clientId: string) {
  return api.get<Member[]>(`/clients/${clientId}/access`);
}

export function fetchBrandKit(clientId: string) {
  return api.get<BrandKit | null>(`/clients/${clientId}/brand-kit`);
}

export function fetchSocialAccounts(clientId: string) {
  return api.get<unknown[]>(`/clients/${clientId}/social-accounts`);
}

export function createClient(payload: Record<string, unknown>) {
  return api.post<Client>('/clients', payload);
}

export function fetchDeletedClients() {
  return api.get<DeletedClient[]>('/clients/deleted');
}

export function deleteClient(clientId: string) {
  return api.delete(`/clients/${clientId}`);
}

export function restoreClient(clientId: string) {
  return api.post(`/clients/${clientId}/restore`, {});
}

export function updateClient(clientId: string, payload: Record<string, unknown>) {
  return api.patch<Client>(`/clients/${clientId}`, payload);
}

export function createUser(payload: Record<string, unknown>) {
  return api.post<{ id: string }>('/users', payload);
}

export function grantClientAccess(clientId: string, userId: string) {
  return api.post(`/clients/${clientId}/access`, { userId });
}

export function revokeClientAccess(clientId: string, userId: string) {
  return api.delete(`/clients/${clientId}/access/${userId}`);
}

export function uploadClientMedia(clientId: string, form: FormData) {
  return api.upload<{ storageUrl: string }>(`/clients/${clientId}/media`, form);
}

export function updateBrandKit(clientId: string, payload: BrandKit) {
  return api.put<BrandKit>(`/clients/${clientId}/brand-kit`, payload);
}
