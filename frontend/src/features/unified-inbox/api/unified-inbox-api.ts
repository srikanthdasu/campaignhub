import { api } from '@/lib/api';
import type { InboxMessage } from '../types';

export function fetchInboxMessages(clientId: string) {
  return api.get<InboxMessage[]>(`/clients/${clientId}/inbox`);
}

export function simulateMessage(
  clientId: string,
  payload: { platform: string; senderName: string; message: string },
) {
  return api.post(`/clients/${clientId}/inbox/simulate`, payload);
}

export function markMessageRead(clientId: string, id: string) {
  return api.patch(`/clients/${clientId}/inbox/${id}/read`);
}

export function replyToMessage(clientId: string, id: string, reply: string) {
  return api.post(`/clients/${clientId}/inbox/${id}/reply`, { reply });
}
