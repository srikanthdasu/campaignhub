export interface Agency {
  id: string;
  name: string;
  plan: string | null;
  subscriptionStatus: string;
  settings: { timezone?: string; brandColor?: string } | null;
}
