import { describe, expect, it, vi } from 'vitest';
import { AppController } from './app.controller.js';
import type { PrismaService } from './prisma/prisma.service.js';

function buildController(dbAvailable: boolean) {
  const prisma = {
    $queryRaw: vi.fn(() =>
      dbAvailable ? Promise.resolve([{ '?column?': 1 }]) : Promise.reject(new Error('connection refused')),
    ),
  };
  return new AppController(prisma as unknown as PrismaService);
}

describe('AppController.health', () => {
  it('returns ok when the database is reachable', async () => {
    const controller = buildController(true);
    await expect(controller.health()).resolves.toEqual({ status: 'ok' });
  });

  it('throws a 503 when the database is unreachable', async () => {
    const controller = buildController(false);
    await expect(controller.health()).rejects.toThrow();
  });
});
