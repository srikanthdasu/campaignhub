import { Role } from '../../generated/prisma/client.js';

export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: Role;
  agencyId: string | null;
}
