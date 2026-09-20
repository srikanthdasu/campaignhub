import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { Role } from '../../generated/prisma/client.js';
import type { AuthenticatedUser } from '../types/authenticated-user.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const user: AuthenticatedUser | undefined = context.switchToHttp().getRequest().user;
    if (!user) {
      throw new ForbiddenException('Insufficient role for this action');
    }
    // Platform-operator role — passes every @Roles() check unconditionally, everywhere, rather
    // than being added to each of the ~15 controllers' own local role arrays individually.
    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role for this action');
    }
    return true;
  }
}
