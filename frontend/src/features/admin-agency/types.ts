import type { Role } from '@/lib/roles';

export const DELETE_GRACE_DAYS = 15;

export const PLANS = ['BASIC', 'PRO', 'BUSINESS', 'ENTERPRISE', 'CUSTOM'] as const;
export const STATUSES = ['ACTIVE', 'PENDING_ONBOARDING', 'INACTIVE', 'BLOCKED'] as const;
export const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP'] as const;
export type ClientPlan = (typeof PLANS)[number];
export type ClientStatus = (typeof STATUSES)[number];

export const STATUS_TONE: Record<ClientStatus, 'accent' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  ACTIVE: 'success',
  PENDING_ONBOARDING: 'warning',
  INACTIVE: 'neutral',
  BLOCKED: 'danger',
};

export const STATUS_LABELS: Record<ClientStatus, string> = {
  ACTIVE: 'Active',
  PENDING_ONBOARDING: 'Pending onboarding',
  INACTIVE: 'Inactive',
  BLOCKED: 'Blocked',
};

export interface Client {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
  website: string | null;
  businessType: string | null;
  industry: string | null;
  address: string | null;
  timeZone: string | null;
  currency: string | null;
  defaultLanguage: string | null;
  allowClientPortalAccess: boolean;
  allowClientContentCreation: boolean;
  notes: string | null;
  plan: ClientPlan;
  status: ClientStatus;
  createdAt: string;
}

export interface DeletedClient extends Client {
  deletedAt: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface BrandKit {
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  voiceGuidelines: string | null;
  aiContext: string | null;
}

export const EMPTY_BRAND_KIT: BrandKit = {
  logoUrl: null,
  primaryColor: '',
  secondaryColor: '',
  voiceGuidelines: '',
  aiContext: '',
};

export interface DetailsForm {
  businessType: string;
  industry: string;
  address: string;
  timeZone: string;
  currency: string;
  defaultLanguage: string;
  allowClientPortalAccess: boolean;
  allowClientContentCreation: boolean;
  notes: string;
  plan: ClientPlan;
  status: ClientStatus;
}

export interface CreatedCredential {
  id: string;
  name: string;
  email: string;
  role: Role;
  password: string;
}
