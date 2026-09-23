import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DemoLeadsService {
  constructor(private prisma: PrismaService) {}

  async create(name: string, email: string) {
    return this.prisma.demoLead.create({ data: { name, email } });
  }

  async list() {
    const [items, total] = await Promise.all([
      this.prisma.demoLead.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.demoLead.count(),
    ]);
    return { items, total };
  }
}
