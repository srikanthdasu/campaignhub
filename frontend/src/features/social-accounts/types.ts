// Public, client-facing identifiers for the WhatsApp Embedded Signup JS SDK popup — not secrets
// (the app secret used to exchange the resulting code for a token stays server-side only).
export const WHATSAPP_APP_ID = '1412830383946851';
export const WHATSAPP_CONFIG_ID = '2037537230301004';

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: {
      init: (options: { appId: string; version: string; xfbml?: boolean }) => void;
      login: (
        callback: (response: { authResponse?: { code?: string } }) => void,
        options: {
          config_id: string;
          response_type: string;
          override_default_response_type: boolean;
          extras?: { setup: Record<string, never> };
        },
      ) => void;
    };
  }
}

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

export interface SocialAccount {
  id: string;
  platform: (typeof PLATFORMS)[number];
  label: string;
  externalAccountId: string | null;
  connectedAt: string;
}
