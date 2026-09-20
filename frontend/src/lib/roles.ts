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
