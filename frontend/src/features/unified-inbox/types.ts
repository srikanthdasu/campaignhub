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

export interface InboxMessage {
  id: string;
  platform: (typeof PLATFORMS)[number];
  senderName: string;
  message: string;
  isRead: boolean;
  receivedAt: string;
}
