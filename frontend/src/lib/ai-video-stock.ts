// Placeholder stand-in for the book's licensed stock media library (step 4, "Media & Assets")
// — a fixed local catalog rather than a real stock API, since no licensing provider is
// configured in this environment. Swapping in a real provider means replacing this constant
// with an API call; the selection UI and AiVideoProject.assets shape stay the same.
export interface StockAsset {
  id: string;
  label: string;
  kind: 'video' | 'image' | 'music';
}

export const STOCK_CATALOG: StockAsset[] = [
  { id: 'stock-v1', label: 'Studio Product Pan', kind: 'video' },
  { id: 'stock-v2', label: 'Lifestyle Walk-and-Talk', kind: 'video' },
  { id: 'stock-v3', label: 'City Skyline Drone', kind: 'video' },
  { id: 'stock-i1', label: 'Flat-Lay Product Shot', kind: 'image' },
  { id: 'stock-i2', label: 'Team at Work', kind: 'image' },
  { id: 'stock-i3', label: 'Minimal Gradient Background', kind: 'image' },
  { id: 'stock-m1', label: 'Upbeat Summer', kind: 'music' },
  { id: 'stock-m2', label: 'Calm Corporate', kind: 'music' },
];
