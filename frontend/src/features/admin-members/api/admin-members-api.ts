import { api } from '@/lib/api';
import { Role } from '@/lib/roles';
import type { Member, AccessOverview, ClientGroupRole } from '../types';

export function fetchMembers() {
  return api.get<Member[]>('/users');
}

export function fetchAccessOverview() {
  return api.get<AccessOverview>('/clients/access-overview');
}

export function createMember(payload: { email: string; name: string; password: string; role: Role }) {
  return api.post('/users', payload);
}

export function changeRole(id: string, newRole: Role) {
  return api.patch(`/users/${id}/role`, { role: newRole });
}

export function toggleActive(id: string, isActive: boolean) {
  return api.patch(`/users/${id}/active`, { isActive });
}

export function resetPassword(id: string, newPassword: string) {
  return api.patch(`/users/${id}/password`, { newPassword });
}

export function grantTeamAccess(clientId: string, userId: string, grantRole: ClientGroupRole) {
  return api.post(`/clients/${clientId}/access`, { userId, role: grantRole });
}

export function quickAssign(clientId: string, userId: string) {
  return api.post(`/clients/${clientId}/access`, { userId, role: 'VIEWER' });
}

export function changeTeamRole(clientId: string, userId: string, newRole: ClientGroupRole) {
  return api.patch(`/clients/${clientId}/access/${userId}`, { role: newRole });
}

export function removeFromTeam(clientId: string, userId: string) {
  return api.delete(`/clients/${clientId}/access/${userId}`);
}
