import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateMemberDto } from './dto/create-member.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
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
    if (dto.role === Role.OWNER && actorRole !== Role.OWNER) {
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
    if (role === Role.OWNER && actorRole !== Role.OWNER) {
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

    return user;
  }

  private async requireAgencyMember(agencyId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.agencyId !== agencyId) {
      throw new NotFoundException('User not found in this agency');
    }
    return user;
  }
}
