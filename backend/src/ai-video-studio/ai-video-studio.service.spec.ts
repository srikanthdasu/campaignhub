import { describe, expect, it, vi } from 'vitest';
import { AiVideoStudioService } from './ai-video-studio.service.js';
import { AiVideoStep } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { AzureAiFoundryService } from '../ai-common/azure-ai-foundry.service.js';

const VALID_SCRIPT_REPLY = JSON.stringify({
  script: 'Scene 1: intro. Scene 2: product.',
  scenes: [
    { title: 'Intro', description: 'Opening shot', durationSec: 4 },
    { title: 'Product', description: 'Close-up', durationSec: 6 },
  ],
});

function buildService(overrides: { project?: any; scriptReply?: string } = {}) {
  const project = overrides.project ?? { id: 'proj-1', clientId: 'client-1', step: AiVideoStep.IDEA };
  const audit = { log: vi.fn() };
  const prisma = {
    aiVideoProject: {
      findUnique: vi.fn(() => Promise.resolve(project)),
      update: vi.fn((args: any) => Promise.resolve({ ...project, ...args.data })),
      delete: vi.fn(() => Promise.resolve({})),
    },
  };
  const foundry = { chat: vi.fn(() => Promise.resolve(overrides.scriptReply ?? VALID_SCRIPT_REPLY)) };
  const service = new AiVideoStudioService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    foundry as unknown as AzureAiFoundryService,
  );
  return { service, prisma, audit, foundry, project };
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
});

describe('AiVideoStudioService.generateScript', () => {
  it('stores the real model script and scenes, and advances the step machine', async () => {
    const { service, prisma } = buildService();
    await service.generateScript('client-1', 'proj-1', { idea: 'eco water bottle launch' } as any);
    expect(prisma.aiVideoProject.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          script: 'Scene 1: intro. Scene 2: product.',
          scenes: [
            { title: 'Intro', description: 'Opening shot', durationSec: 4 },
            { title: 'Product', description: 'Close-up', durationSec: 6 },
          ],
          step: AiVideoStep.SCRIPT,
        }),
      }),
    );
  });

  it('rejects a response that is not valid JSON', async () => {
    const { service } = buildService({ scriptReply: 'Sure, here is a script...' });
    await expect(
      service.generateScript('client-1', 'proj-1', { idea: 'x' } as any),
    ).rejects.toThrow('could not parse');
  });

  it('rejects a response missing the scenes array', async () => {
    const { service } = buildService({ scriptReply: JSON.stringify({ script: 'just a script' }) });
    await expect(
      service.generateScript('client-1', 'proj-1', { idea: 'x' } as any),
    ).rejects.toThrow('unexpected response');
  });
});
