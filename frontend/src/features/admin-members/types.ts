import { Role } from '@/lib/roles';

export const CLIENT_GROUP_ROLES = ['MANAGER', 'APPROVER', 'VIEWER'] as const;
export type ClientGroupRole = (typeof CLIENT_GROUP_ROLES)[number];

export const CLIENT_GROUP_ROLE_LABELS: Record<ClientGroupRole, string> = {
  MANAGER: 'Manager',
  APPROVER: 'Approver',
  VIEWER: 'Viewer',
};

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export interface ClientTeamMember extends Member {
  accessRole: ClientGroupRole;
}

export interface ClientGroup {
  id: string;
  name: string;
  members: ClientTeamMember[];
}

export interface AccessOverview {
  totalClients: number;
  totalMembers: number;
  unassignedCount: number;
  clients: ClientGroup[];
  unassigned: Member[];
}
