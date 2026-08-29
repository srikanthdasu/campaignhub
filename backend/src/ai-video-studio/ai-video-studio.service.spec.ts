import { describe, expect, it, vi } from 'vitest';
import { AiVideoStudioService } from './ai-video-studio.service.js';
import { AiVideoStep } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';

function buildService(overrides: { project?: any } = {}) {
  const project = overrides.project ?? { id: 'proj-1', clientId: 'client-1', step: AiVideoStep.IDEA };
  const audit = { log: vi.fn() };
  const prisma = {
    aiVideoProject: {
      findUnique: vi.fn(() => Promise.resolve(project)),
      update: vi.fn((args: any) => Promise.resolve({ ...project, ...args.data })),
      delete: vi.fn(() => Promise.resolve({})),
    },
  };
  const service = new AiVideoStudioService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  return { service, prisma, audit, project };
}

describe('AiVideoStudioService — tenant scoping', () => {
  const otherClientProject = { id: 'proj-1', clientId: 'other-client', step: AiVideoStep.IDEA };

  it('rejects generating a script for a project from a different client', async () => {
    const { service } = buildService({ project: otherClientProject });
    await expect(
      service.generateScript('client-1', 'proj-1', { idea: 'x' } as any),
    ).rejects.toThrow('Video project not found for this client');
  });

  it('rejects rendering a project from a different client', async () => {
    const { service } = buildService({ project: otherClientProject });
    await expect(service.render('client-1', 'proj-1', 'actor-1')).rejects.toThrow(
      'Video project not found for this client',
    );
  });

  it('rejects deleting a project from a different client', async () => {
    const { service, prisma } = buildService({ project: otherClientProject });
    await expect(service.remove('client-1', 'proj-1', 'actor-1')).rejects.toThrow(
      'Video project not found for this client',
    );
    expect(prisma.aiVideoProject.delete).not.toHaveBeenCalled();
  });

  it('render() flags its output as simulated and never claims a real video was produced', async () => {
    const { service, audit } = buildService();
    await service.render('client-1', 'proj-1', 'actor-1');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ metadata: { simulated: true } }));
  });

  it('advances the project through its step machine as each stage completes', async () => {
    const { service, prisma } = buildService();
    await service.generateScript('client-1', 'proj-1', { idea: 'x' } as any);
    expect(prisma.aiVideoProject.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ step: AiVideoStep.SCRIPT }) }),
    );
  });
});
