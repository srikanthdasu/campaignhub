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
