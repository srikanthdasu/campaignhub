import {
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaPinterest,
  FaTiktok,
  FaWhatsapp,
  FaXTwitter,
  FaYoutube,
} from 'react-icons/fa6';
import type { IconType } from 'react-icons';

export const PLATFORM_ICONS: Record<string, IconType> = {
  FACEBOOK: FaFacebook,
  INSTAGRAM: FaInstagram,
  LINKEDIN: FaLinkedin,
  X: FaXTwitter,
  TIKTOK: FaTiktok,
  YOUTUBE: FaYoutube,
  PINTEREST: FaPinterest,
  WHATSAPP: FaWhatsapp,
};

// Real per-brand colors rather than a single monochrome tone — react-icons glyphs instead of
// the old PNG crops, so these stay crisp at any size with no image-loading dependency at all.
export const PLATFORM_COLORS: Record<string, string> = {
  FACEBOOK: '#1877F2',
  INSTAGRAM: '#E1306C',
  LINKEDIN: '#0A66C2',
  X: '#F5F5F7',
  TIKTOK: '#25F4EE',
  YOUTUBE: '#FF0000',
  PINTEREST: '#E60023',
  WHATSAPP: '#25D366',
};

export const PLATFORM_ORDER = [
  'INSTAGRAM',
  'FACEBOOK',
  'LINKEDIN',
  'X',
  'TIKTOK',
  'YOUTUBE',
  'PINTEREST',
  'WHATSAPP',
] as const;
