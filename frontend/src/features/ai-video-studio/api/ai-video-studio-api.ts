import { api } from '@/lib/api';
import type { Enhancements, Scene, VideoProject } from '../types';

export function fetchProjects(clientId: string) {
  return api.get<VideoProject[]>(`/clients/${clientId}/ai-video-studio/projects`);
}

export function fetchProjectDetail(clientId: string, id: string) {
  return api.get<VideoProject>(`/clients/${clientId}/ai-video-studio/projects/${id}`);
}

export function createProject(clientId: string, payload: { title: string; idea: string }) {
  return api.post<VideoProject>(`/clients/${clientId}/ai-video-studio/projects`, payload);
}

export function generateScript(clientId: string, id: string, payload: { idea: string }) {
  return api.post(`/clients/${clientId}/ai-video-studio/projects/${id}/script`, payload);
}

export function saveStoryboard(clientId: string, id: string, payload: { scenes: Scene[] }) {
  return api.post(`/clients/${clientId}/ai-video-studio/projects/${id}/storyboard`, payload);
}

export function saveAssets(clientId: string, id: string, payload: { assetIds: string[] }) {
  return api.post(`/clients/${clientId}/ai-video-studio/projects/${id}/assets`, payload);
}

export function saveEnhancements(clientId: string, id: string, payload: Enhancements) {
  return api.post(`/clients/${clientId}/ai-video-studio/projects/${id}/enhancements`, payload);
}

export function renderPreview(clientId: string, id: string) {
  return api.post(`/clients/${clientId}/ai-video-studio/projects/${id}/render`);
}

export function exportVideo(clientId: string, id: string, payload: { format: string }) {
  return api.post(`/clients/${clientId}/ai-video-studio/projects/${id}/export`, payload);
}

export function publishProject(clientId: string, id: string) {
  return api.post(`/clients/${clientId}/ai-video-studio/projects/${id}/publish`);
}

export function deleteProject(clientId: string, id: string) {
  return api.delete(`/clients/${clientId}/ai-video-studio/projects/${id}`);
}
