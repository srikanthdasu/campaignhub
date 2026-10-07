// The roles selectable anywhere in the UI — every dropdown maps over this array. SUPER_ADMIN is
// deliberately not a member: it must never become pickable by construction, not by a filter
// someone could forget to apply at a call site. `Role` (below) is intentionally a wider type than
// this array, so the app can still type-check a logged-in Super Admin's session.
export const ROLES = [
  'OWNER',
  'ADMIN',
  'MANAGER',
  'CREATOR',
  'DESIGNER',
  'ANALYST',
  'CLIENT',
] as const;

export type Role = (typeof ROLES)[number] | 'SUPER_ADMIN';

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  CREATOR: 'Creator',
  DESIGNER: 'Designer',
  ANALYST: 'Analyst',
  CLIENT: 'Client',
  SUPER_ADMIN: 'Super Admin',
};

export const AGENCY_ADMIN_ROLES: Role[] = ['OWNER', 'ADMIN', 'SUPER_ADMIN'];

export function isAgencyAdmin(role: Role | undefined): boolean {
  return !!role && AGENCY_ADMIN_ROLES.includes(role);
}

// Mirrors CAN_MANAGE in media.controller.ts and ai-assistant.controller.ts — the backend's real
// boundary for editing/deleting media assets and AI Assistant conversations, excluding CLIENT and
// ANALYST. This is UX-only (hiding a control the backend would 403 anyway), not a security
// boundary in itself — the backend guard is what actually enforces it.
export const CAN_MANAGE_MEDIA_ROLES: Role[] = ['OWNER', 'ADMIN', 'MANAGER', 'CREATOR', 'DESIGNER', 'SUPER_ADMIN'];

export function canManageMedia(role: Role | undefined): boolean {
  return !!role && CAN_MANAGE_MEDIA_ROLES.includes(role);
}

// Mirrors CAN_MANAGE in email-campaigns.controller.ts — the backend's real boundary for deleting
// an email campaign or sending one, excluding CLIENT (who can draft/edit via CAN_EDIT there, but
// never send). UX-only — the backend guard is what actually enforces it.
export const CAN_SEND_EMAIL_CAMPAIGNS_ROLES: Role[] = ['OWNER', 'ADMIN', 'MANAGER', 'SUPER_ADMIN'];

export function canSendEmailCampaigns(role: Role | undefined): boolean {
  return !!role && CAN_SEND_EMAIL_CAMPAIGNS_ROLES.includes(role);
}

// Mirrors CAN_DELETE in campaigns.controller.ts — the backend's real boundary for deleting a
// campaign, excluding CLIENT (who can create/edit via CAN_MANAGE there, but never delete).
// UX-only — the backend guard is what actually enforces it.
export const CAN_DELETE_CAMPAIGNS_ROLES: Role[] = ['OWNER', 'ADMIN', 'MANAGER', 'SUPER_ADMIN'];

export function canDeleteCampaigns(role: Role | undefined): boolean {
  return !!role && CAN_DELETE_CAMPAIGNS_ROLES.includes(role);
}
