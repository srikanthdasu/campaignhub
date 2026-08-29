import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';
import { Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(agencyId: string, actorId: string, dto: CreateClientDto) {
    const client = await this.prisma.client.create({
      data: { agencyId, name: dto.name, brandKitId: dto.brandKitId },
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
        where: { agencyId: user.agencyId! },
        orderBy: { createdAt: 'asc' },
      });
    }

    return this.prisma.client.findMany({
      where: {
        agencyId: user.agencyId!,
        userAccess: { some: { userId: user.sub } },
      },
      orderBy: { createdAt: 'asc' },
    });
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
      data: { name: dto.name, brandKitId: dto.brandKitId },
    });

    await this.audit.log({
      userId: actorId,
      action: 'CLIENT_UPDATED',
      entityType: 'client',
      entityId: clientId,
    });

    return client;
  }

  async grantAccess(agencyId: string, actorId: string, clientId: string, targetUserId: string) {
    await this.requireInAgency(agencyId, clientId);

    const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser || targetUser.agencyId !== agencyId) {
      throw new BadRequestException('User does not belong to this agency');
    }

    await this.prisma.userClientAccess.upsert({
      where: { userId_clientId: { userId: targetUserId, clientId } },
      create: { userId: targetUserId, clientId },
      update: {},
    });

    await this.audit.log({
      userId: actorId,
      action: 'CLIENT_ACCESS_GRANTED',
      entityType: 'client',
      entityId: clientId,
      metadata: { targetUserId },
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

  private async requireInAgency(agencyId: string, clientId: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.agencyId !== agencyId) {
      throw new NotFoundException('Client not found in this agency');
    }
    return client;
  }
}
