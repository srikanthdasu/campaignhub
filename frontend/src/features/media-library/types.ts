export const TYPE_LABELS: Record<string, string> = {
  IMAGE: 'Images',
  VIDEO: 'Videos',
  GIF: 'GIFs',
  AUDIO: 'Audio',
  DOCUMENT: 'Documents',
};

export interface Campaign {
  id: string;
  name: string;
}

export interface MediaAsset {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'GIF' | 'AUDIO' | 'DOCUMENT';
  storageUrl: string;
  fileName: string;
  title: string | null;
  description: string | null;
  fileSize: number | null;
  folder: string | null;
  tags: string[];
  campaignId: string | null;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}
