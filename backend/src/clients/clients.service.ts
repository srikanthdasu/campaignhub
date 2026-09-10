import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';
import { ClientGroupRole, Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(agencyId: string, actorId: string, dto: CreateClientDto) {
    const client = await this.prisma.client.create({
      data: {
        agencyId,
        name: dto.name,
        brandKitId: dto.brandKitId,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        phone: dto.phone,
        website: dto.website,
        businessType: dto.businessType,
        industry: dto.industry,
        address: dto.address,
        timeZone: dto.timeZone,
        currency: dto.currency,
        defaultLanguage: dto.defaultLanguage,
        allowClientPortalAccess: dto.allowClientPortalAccess,
        notes: dto.notes,
        plan: dto.plan,
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'CLIENT_CREATED',
      entityType: 'client',
      entityId: client.id,
    });

    return client;
  }

  async listForUser(user: AuthenticatedUser) {
    if (user.role === Role.OWNER || user.role === Role.ADMIN) {
      return this.prisma.client.findMany({
        where: { agencyId: user.agencyId!, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
    }

    return this.prisma.client.findMany({
      where: {
        agencyId: user.agencyId!,
        deletedAt: null,
        userAccess: { some: { userId: user.sub } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Recoverable for GRACE_PERIOD_DAYS after softDelete — purgeExpired() (run daily by
  // ClientsCronService) permanently removes anything past that window.
  listDeleted(agencyId: string) {
    return this.prisma.client.findMany({
      where: { agencyId, deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async softDelete(agencyId: string, actorId: string, clientId: string) {
    const client = await this.requireInAgency(agencyId, clientId);
    if (client.deletedAt) {
      throw new BadRequestException('Client is already deleted');
    }

    await this.prisma.client.update({ where: { id: clientId }, data: { deletedAt: new Date() } });

    await this.audit.log({
      userId: actorId,
      action: 'CLIENT_DELETED',
      entityType: 'client',
      entityId: clientId,
    });
  }

  async restore(agencyId: string, actorId: string, clientId: string) {
    const client = await this.requireInAgency(agencyId, clientId);
    if (!client.deletedAt) {
      throw new BadRequestException('Client is not deleted');
    }

    const restored = await this.prisma.client.update({
      where: { id: clientId },
      data: { deletedAt: null },
    });

    await this.audit.log({
      userId: actorId,
      action: 'CLIENT_RESTORED',
      entityType: 'client',
      entityId: clientId,
    });

    return restored;
  }

  /** Called by ClientsCronService — no user in the loop, so no access check or actor on the audit entry. */
  async purgeExpired(graceDays: number) {
    const cutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000);
    const due = await this.prisma.client.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true, name: true },
    });
    if (due.length === 0) return 0;

    await this.prisma.client.deleteMany({ where: { id: { in: due.map((c) => c.id) } } });

    await this.audit.log({
      action: 'CLIENT_PURGED',
      entityType: 'client',
      entityId: due.map((c) => c.id).join(','),
      metadata: { count: due.length, names: due.map((c) => c.name) },
    });

    return due.length;
  }

  async findOne(clientId: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async update(agencyId: string, actorId: string, clientId: string, dto: UpdateClientDto) {
    await this.requireInAgency(agencyId, clientId);

    const client = await this.prisma.client.update({
      where: { id: clientId },
      data: {
        name: dto.name,
        brandKitId: dto.brandKitId,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        phone: dto.phone,
        website: dto.website,
        businessType: dto.businessType,
        industry: dto.industry,
        address: dto.address,
        timeZone: dto.timeZone,
        currency: dto.currency,
        defaultLanguage: dto.defaultLanguage,
        allowClientPortalAccess: dto.allowClientPortalAccess,
        notes: dto.notes,
        plan: dto.plan,
        status: dto.status,
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'CLIENT_UPDATED',
      entityType: 'client',
      entityId: clientId,
    });

    return client;
  }

  async listAccess(agencyId: string, clientId: string) {
    await this.requireInAgency(agencyId, clientId);

    const access = await this.prisma.userClientAccess.findMany({
      where: { clientId },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });

    return access.map((a) => ({ ...a.user, accessRole: a.role }));
  }

  async grantAccess(
    agencyId: string,
    actorId: string,
    clientId: string,
    targetUserId: string,
    role: ClientGroupRole = ClientGroupRole.VIEWER,
  ) {
    await this.requireInAgency(agencyId, clientId);

    const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser || targetUser.agencyId !== agencyId) {
      throw new BadRequestException('User does not belong to this agency');
    }

    await this.prisma.userClientAccess.upsert({
      where: { userId_clientId: { userId: targetUserId, clientId } },
      create: { userId: targetUserId, clientId, role },
      update: { role },
    });

    await this.audit.log({
      userId: actorId,
      action: 'CLIENT_ACCESS_GRANTED',
      entityType: 'client',
      entityId: clientId,
      metadata: { targetUserId, role },
    });
  }

  async updateAccessRole(
    agencyId: string,
    actorId: string,
    clientId: string,
    targetUserId: string,
    role: ClientGroupRole,
  ) {
    await this.requireInAgency(agencyId, clientId);

    const existing = await this.prisma.userClientAccess.findUnique({
      where: { userId_clientId: { userId: targetUserId, clientId } },
    });
    if (!existing) {
      throw new NotFoundException('This user does not have access to this client');
    }

    await this.prisma.userClientAccess.update({
      where: { userId_clientId: { userId: targetUserId, clientId } },
      data: { role },
    });

    await this.audit.log({
      userId: actorId,
      action: 'CLIENT_ACCESS_ROLE_CHANGED',
      entityType: 'client',
      entityId: clientId,
      metadata: { targetUserId, role },
    });
  }

  async revokeAccess(agencyId: string, actorId: string, clientId: string, targetUserId: string) {
    await this.requireInAgency(agencyId, clientId);

    await this.prisma.userClientAccess.deleteMany({
      where: { userId: targetUserId, clientId },
    });

    await this.audit.log({
      userId: actorId,
      action: 'CLIENT_ACCESS_REVOKED',
      entityType: 'client',
      entityId: clientId,
      metadata: { targetUserId },
    });
  }

  /**
   * One real round trip for the Members page's "grouped by client" view: every non-deleted
   * client with its real access list, plus which agency members have no client grant at all
   * (agency-wide staff like Owner/Admin usually fall here since they bypass per-client grants).
   */
  async getAccessOverview(agencyId: string) {
    const [clients, allMembers] = await Promise.all([
      this.prisma.client.findMany({
        where: { agencyId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          userAccess: {
            include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true } } },
          },
        },
      }),
      this.prisma.user.findMany({
        where: { agencyId },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      }),
    ]);

    const assignedUserIds = new Set(clients.flatMap((c) => c.userAccess.map((a) => a.userId)));
    const unassigned = allMembers.filter((m) => !assignedUserIds.has(m.id));

    return {
      totalClients: clients.length,
      totalMembers: allMembers.length,
      unassignedCount: unassigned.length,
      clients: clients.map((c) => ({
        id: c.id,
        name: c.name,
        members: c.userAccess.map((a) => ({ ...a.user, accessRole: a.role })),
      })),
      unassigned,
    };
  }

  private async requireInAgency(agencyId: string, clientId: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.agencyId !== agencyId) {
      throw new NotFoundException('Client not found in this agency');
    }
    return client;
  }
}
