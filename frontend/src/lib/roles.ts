export const ROLES = [
  'OWNER',
  'ADMIN',
  'MANAGER',
  'CREATOR',
  'DESIGNER',
  'ANALYST',
  'CLIENT',
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  CREATOR: 'Creator',
  DESIGNER: 'Designer',
  ANALYST: 'Analyst',
  CLIENT: 'Client',
};

export const AGENCY_ADMIN_ROLES: Role[] = ['OWNER', 'ADMIN'];

export function isAgencyAdmin(role: Role | undefined): boolean {
  return !!role && AGENCY_ADMIN_ROLES.includes(role);
}
