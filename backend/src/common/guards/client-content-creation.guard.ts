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
 * Gates content-creation endpoints (Content Planner, AI Captions/Image/Assistant/Video Studio)
 * for the CLIENT role behind Client.allowClientContentCreation — off by default, so a client can
 * only draft content once an agency admin explicitly opts them in. No-op for every other role;
 * ClientAccessGuard has already verified those roles' access to the client by the time this runs.
 */
@Injectable()
export class ClientContentCreationGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user || user.role !== Role.CLIENT) {
      return true;
    }

    const clientId: string | undefined = request.params.clientId ?? request.params.id;
    if (!clientId) {
      throw new ForbiddenException('Client access could not be verified');
    }

    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (!client.allowClientContentCreation) {
      throw new ForbiddenException(
        'Content creation is not enabled for your account yet — ask your agency to turn it on.',
      );
    }

    return true;
  }
}
