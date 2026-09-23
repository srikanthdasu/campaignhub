import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateMemberDto } from './dto/create-member.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { Role, type Prisma } from '../generated/prisma/client.js';

const BCRYPT_ROUNDS = 12;

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  agencyId: true,
  isActive: true,
  notificationPrefs: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: SAFE_USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        notificationPrefs: dto.notificationPrefs as Prisma.InputJsonValue | undefined,
      },
      select: SAFE_USER_SELECT,
    });

    await this.audit.log({
      userId,
      action: 'PROFILE_UPDATED',
      entityType: 'user',
      entityId: userId,
    });

    return user;
  }

  async listForAgency(agencyId: string) {
    return this.prisma.user.findMany({
      where: { agencyId },
      select: SAFE_USER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async createMember(agencyId: string, actorId: string, actorRole: Role, dto: CreateMemberDto) {
    // Not a display omission from ROLES on the frontend — the only way this role can ever exist
    // on an account is a one-off script run directly against the database, never through the app.
    if (dto.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('This role cannot be assigned through the app');
    }
    if (dto.role === Role.OWNER && actorRole !== Role.OWNER && actorRole !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only an Owner can create another Owner');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    if (dto.clientIds?.length) {
      const count = await this.prisma.client.count({
        where: { id: { in: dto.clientIds }, agencyId },
      });
      if (count !== dto.clientIds.length) {
        throw new BadRequestException('One or more clients do not belong to this agency');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        agencyId,
        email: dto.email,
        name: dto.name,
        role: dto.role,
        passwordHash,
        // Created by a trusted agency admin who already vouches for this email — unlike public
        // self-registration (AuthService.register()), there's no untrusted party to verify against,
        // so this account is pre-verified rather than blocked on an email link nobody would send.
        emailVerifiedAt: new Date(),
        clientAccess: dto.clientIds?.length
          ? { create: dto.clientIds.map((clientId) => ({ clientId })) }
          : undefined,
      },
      select: SAFE_USER_SELECT,
    });

    await this.audit.log({
      userId: actorId,
      action: 'MEMBER_CREATED',
      entityType: 'user',
      entityId: user.id,
      metadata: { role: user.role },
    });

    return user;
  }

  async updateRole(
    agencyId: string,
    actorId: string,
    actorRole: Role,
    targetUserId: string,
    role: Role,
  ) {
    if (role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('This role cannot be assigned through the app');
    }
    if (role === Role.OWNER && actorRole !== Role.OWNER && actorRole !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only an Owner can promote a member to Owner');
    }

    const target = await this.requireAgencyMember(agencyId, targetUserId);

    if (target.role === Role.OWNER && role !== Role.OWNER) {
      const ownerCount = await this.prisma.user.count({
        where: { agencyId, role: Role.OWNER },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException('An agency must always have at least one Owner');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role },
      select: SAFE_USER_SELECT,
    });

    await this.audit.log({
      userId: actorId,
      action: 'MEMBER_ROLE_CHANGED',
      entityType: 'user',
      entityId: targetUserId,
      metadata: { from: target.role, to: role },
    });

    await this.notifications.create(
      targetUserId,
      `Your role was changed from ${target.role} to ${role}.`,
      '/profile',
    );

    return user;
  }

  async setActive(agencyId: string, actorId: string, targetUserId: string, isActive: boolean) {
    const target = await this.requireAgencyMember(agencyId, targetUserId);

    if (targetUserId === actorId && !isActive) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }

    if (target.role === Role.OWNER && !isActive) {
      const activeOwnerCount = await this.prisma.user.count({
        where: { agencyId, role: Role.OWNER, isActive: true },
      });
      if (activeOwnerCount <= 1) {
        throw new BadRequestException('An agency must always have at least one active Owner');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { isActive },
      select: SAFE_USER_SELECT,
    });

    await this.audit.log({
      userId: actorId,
      action: isActive ? 'MEMBER_ACTIVATED' : 'MEMBER_DEACTIVATED',
      entityType: 'user',
      entityId: targetUserId,
    });

    if (!isActive) {
      await this.notifications.create(
        targetUserId,
        'Your account was deactivated by an agency admin.',
        '/profile',
      );
    }

    return user;
  }

  async changeOwnPassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const matches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!matches) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    await this.audit.log({ userId, action: 'PASSWORD_CHANGED', entityType: 'user', entityId: userId });
  }

  /** Owner/Admin override — resets a member's password directly, no current password needed. */
  async resetMemberPassword(agencyId: string, actorId: string, targetUserId: string, newPassword: string) {
    await this.requireAgencyMember(agencyId, targetUserId);

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({ where: { id: targetUserId }, data: { passwordHash } });

    await this.audit.log({
      userId: actorId,
      action: 'PASSWORD_RESET_BY_ADMIN',
      entityType: 'user',
      entityId: targetUserId,
    });
  }

  /**
   * Super Admin only — the entire mechanism behind "switch into any agency, act as its Owner."
   * Updates the caller's OWN agencyId, so every existing agency-scoped query in the codebase
   * keeps working unmodified: the account genuinely, temporarily belongs to the target agency.
   * Logged to that agency's own audit trail — every action taken afterward is attributable, not
   * a hidden backdoor.
   */
  async actAsAgency(actorId: string, previousAgencyId: string | null, targetAgencyId: string) {
    const agency = await this.prisma.agency.findUnique({ where: { id: targetAgencyId } });
    if (!agency) throw new NotFoundException('Agency not found');

    const user = await this.prisma.user.update({
      where: { id: actorId },
      data: { agencyId: targetAgencyId },
      select: SAFE_USER_SELECT,
    });

    await this.audit.log({
      userId: actorId,
      agencyId: targetAgencyId,
      action: 'SUPER_ADMIN_SWITCHED_AGENCY',
      entityType: 'agency',
      entityId: targetAgencyId,
      metadata: { from: previousAgencyId, to: targetAgencyId, agencyName: agency.name },
    });

    return user;
  }

  /** Super Admin only — the agency picker for actAsAgency(). */
  async listAllAgencies() {
    return this.prisma.agency.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { users: true, clients: true } },
      },
    });
  }

  private async requireAgencyMember(agencyId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.agencyId !== agencyId) {
      throw new NotFoundException('User not found in this agency');
    }
    return user;
  }
}
