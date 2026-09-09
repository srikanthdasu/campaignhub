import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Role } from '../../generated/prisma/client.js';
import type { AuthenticatedUser } from '../types/authenticated-user.js';

/**
 * Verifies the current user may act on the :clientId (or :id) route param —
 * OWNER/ADMIN have whole-agency scope, everyone else needs a user_client_access row.
 */
@Injectable()
export class ClientAccessGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    const clientId: string | undefined = request.params.clientId ?? request.params.id;

    if (!user || !clientId) {
      throw new ForbiddenException('Client access could not be verified');
    }

    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (client.agencyId !== user.agencyId) {
      throw new ForbiddenException('Client belongs to a different agency');
    }

    if (user.role === Role.OWNER || user.role === Role.ADMIN) {
      return true;
    }

    const access = await this.prisma.userClientAccess.findUnique({
      where: { userId_clientId: { userId: user.sub, clientId } },
    });

    if (!access) {
      throw new ForbiddenException('You do not have access to this client');
    }

    // The agency's own team keeps working the account even while portal access is off for the
    // client — this only gates the client's own users, matching the "Allow Client Portal Access"
    // toggle's intent (temporarily lock the client out without touching internal access grants).
    if (user.role === Role.CLIENT && !client.allowClientPortalAccess) {
      throw new ForbiddenException('Client portal access is currently disabled for this client');
    }

    return true;
  }
}
