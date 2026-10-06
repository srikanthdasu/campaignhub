export const TONES = ['Friendly', 'Professional', 'Playful', 'Bold'] as const;
export const PLATFORMS = [
  'INSTAGRAM',
  'FACEBOOK',
  'LINKEDIN',
  'X',
  'TIKTOK',
  'YOUTUBE',
  'PINTEREST',
  'WHATSAPP',
] as const;

export interface Variant {
  text: string;
  hashtags: string[];
}

export interface SavedCaption extends Variant {
  id: string;
  input: string;
  tone: string;
  platform: (typeof PLATFORMS)[number] | null;
  createdAt: string;
}
