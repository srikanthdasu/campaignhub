import { describe, expect, it, vi } from 'vitest';
import { DemoLeadsService } from './demo-leads.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function buildService(overrides: { leads?: any[] } = {}) {
  const prisma = {
    demoLead: {
      create: vi.fn((args: any) => Promise.resolve({ id: 'lead-1', createdAt: new Date(), ...args.data })),
      findMany: vi.fn(() => Promise.resolve(overrides.leads ?? [])),
      count: vi.fn(() => Promise.resolve(overrides.leads?.length ?? 0)),
    },
  };
  const service = new DemoLeadsService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe('DemoLeadsService.create', () => {
  it('stores the name and email', async () => {
    const { service, prisma } = buildService();
    await service.create('Priya', 'priya@example.com');
    expect(prisma.demoLead.create).toHaveBeenCalledWith({
      data: { name: 'Priya', email: 'priya@example.com' },
    });
  });
});

describe('DemoLeadsService.list', () => {
  it('returns leads newest-first alongside the total count', async () => {
    const leads = [{ id: 'lead-1' }, { id: 'lead-2' }];
    const { service, prisma } = buildService({ leads });
    const result = await service.list();
    expect(prisma.demoLead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
    expect(result).toEqual({ items: leads, total: 2 });
  });
});
