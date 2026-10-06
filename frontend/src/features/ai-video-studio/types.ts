export const STEPS = [
  { key: 'IDEA', label: 'Idea / Input' },
  { key: 'SCRIPT', label: 'Script' },
  { key: 'STORYBOARD', label: 'Scene Builder' },
  { key: 'ASSETS', label: 'Media & Assets' },
  { key: 'ENHANCE', label: 'Edit & Enhance' },
  { key: 'PREVIEW', label: 'Preview' },
  { key: 'EXPORT', label: 'Export' },
  { key: 'PUBLISHED', label: 'Publish' },
] as const;

export type StepKey = (typeof STEPS)[number]['key'];

export interface Scene {
  title: string;
  description: string;
  durationSec: number;
}

export interface Enhancements {
  autoCut?: boolean;
  smoothTransitions?: boolean;
  autoCaptions?: boolean;
  colorCorrection?: boolean;
  brandWatermark?: boolean;
  backgroundMusic?: string;
}

export interface VideoProject {
  id: string;
  title: string;
  idea: string | null;
  script: string | null;
  scenes: Scene[] | null;
  assets: string[] | null;
  enhancements: Enhancements | null;
  step: StepKey;
  previewUrl: string | null;
  videoUrl: string | null;
  exportFormat: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

export const ENHANCE_TOGGLES: { key: keyof Enhancements; label: string }[] = [
  { key: 'autoCut', label: 'Auto Cut' },
  { key: 'smoothTransitions', label: 'Smooth Transitions' },
  { key: 'autoCaptions', label: 'Auto Captions' },
  { key: 'colorCorrection', label: 'Color Correction' },
  { key: 'brandWatermark', label: 'Brand Watermark' },
];
