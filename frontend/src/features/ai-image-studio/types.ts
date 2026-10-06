export const IMAGE_TYPES = [
  { key: 'SOCIAL', label: 'Social Media Post', promptPrefix: 'Square social media post: ', size: '1024x1024' },
  { key: 'BANNER', label: 'Banner / Cover', promptPrefix: 'Wide banner/cover image: ', size: '1792x1024' },
  { key: 'AD', label: 'Ad Creative', promptPrefix: 'Eye-catching ad creative: ', size: '1024x1024' },
  { key: 'PRODUCT', label: 'Product Image', promptPrefix: 'Clean professional product photography: ', size: '1024x1024' },
  { key: 'EVENT', label: 'Event / Festival', promptPrefix: 'Festive promotional graphic: ', size: '1024x1024' },
  { key: 'CUSTOM', label: 'Custom', promptPrefix: '', size: '1024x1024' },
] as const;

export const STYLES = ['Modern & Vibrant', 'Minimal & Clean', 'Bold & Playful', 'Elegant & Muted'] as const;

export const ASPECT_RATIOS = [
  { value: '1024x1024', label: 'Square (1:1)' },
  { value: '1024x1792', label: 'Portrait (Story/Reel)' },
  { value: '1792x1024', label: 'Landscape (Banner/Cover)' },
] as const;

export const SUGGESTED_PROMPTS = [
  'Summer sale offer',
  'New product launch',
  'Festival wishes',
  'Customer testimonial',
  'Food promotion',
  'Real estate listing',
];

export const BATCH_SIZE = 4;
export const REAL_PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'X', 'TIKTOK', 'YOUTUBE', 'PINTEREST', 'WHATSAPP'];

export interface Campaign {
  id: string;
  name: string;
}

export interface MediaAsset {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'GIF' | 'AUDIO' | 'DOCUMENT';
  storageUrl: string;
  fileName: string;
  prompt: string | null;
  aiProvider: string | null;
  usageCount: number;
  createdAt: string;
}
