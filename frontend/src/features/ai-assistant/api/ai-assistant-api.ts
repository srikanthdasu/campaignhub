import { api } from '@/lib/api';
import type { Message } from '../types';

export function fetchConversations(clientId: string) {
  return api.get<
    { id: string; title: string; updatedAt: string; _count: { messages: number } }[]
  >(`/clients/${clientId}/ai-assistant/conversations`);
}

export function fetchConversationDetail(clientId: string, id: string) {
  return api.get<{ messages: Message[] }>(`/clients/${clientId}/ai-assistant/conversations/${id}`);
}

export function createConversation(clientId: string) {
  return api.post<{ id: string }>(`/clients/${clientId}/ai-assistant/conversations`, {});
}

export function deleteConversation(clientId: string, id: string) {
  return api.delete(`/clients/${clientId}/ai-assistant/conversations/${id}`);
}

export function sendMessage(clientId: string, conversationId: string, content: string) {
  return api.post<{ userMessage: Message; assistantMessage: Message }>(
    `/clients/${clientId}/ai-assistant/conversations/${conversationId}/messages`,
    { content },
  );
}
