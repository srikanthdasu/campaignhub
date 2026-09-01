import { describe, expect, it, vi } from 'vitest';
import { AiVideoStudioService } from './ai-video-studio.service.js';
import { AiVideoStep } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { AzureAiFoundryService } from '../ai-common/azure-ai-foundry.service.js';
import type { BlobStorageService } from '../media/blob-storage.service.js';

const VALID_SCRIPT_REPLY = JSON.stringify({
  script: 'Scene 1: intro. Scene 2: product.',
  scenes: [
    { title: 'Intro', description: 'Opening shot', durationSec: 4 },
    { title: 'Product', description: 'Close-up', durationSec: 6 },
  ],
});

function buildService(overrides: { project?: any; scriptReply?: string } = {}) {
  const project = overrides.project ?? {
    id: 'proj-1',
    clientId: 'client-1',
    title: 'Launch Teaser',
    idea: 'eco water bottle launch',
    scenes: null,
    step: AiVideoStep.IDEA,
  };
  const audit = { log: vi.fn() };
  const prisma = {
    aiVideoProject: {
      findUnique: vi.fn(() => Promise.resolve(project)),
      update: vi.fn((args: any) => Promise.resolve({ ...project, ...args.data })),
      delete: vi.fn(() => Promise.resolve({})),
    },
  };
  const foundry = {
    chat: vi.fn(() => Promise.resolve(overrides.scriptReply ?? VALID_SCRIPT_REPLY)),
    generateImage: vi.fn(() => Promise.resolve(Buffer.from('fake-png-bytes'))),
  };
  const blobStorage = {
    upload: vi.fn(() => Promise.resolve('/uploads/fake-generated.png')),
    remove: vi.fn(() => Promise.resolve()),
  };
  const service = new AiVideoStudioService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    foundry as unknown as AzureAiFoundryService,
    blobStorage as unknown as BlobStorageService,
  );
  return { service, prisma, audit, foundry, blobStorage, project };
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

describe('AiVideoStudioService.render', () => {
  it('generates a real preview image, uploads it, and stores the returned URL', async () => {
    const { service, prisma, blobStorage } = buildService();
    const project = await service.render('client-1', 'proj-1', 'actor-1');

    expect(blobStorage.upload).toHaveBeenCalledWith(Buffer.from('fake-png-bytes'), '.png', 'image/png');

    expect(prisma.aiVideoProject.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ previewUrl: '/uploads/fake-generated.png', step: AiVideoStep.PREVIEW }),
      }),
    );
    expect(project.step).toBe(AiVideoStep.PREVIEW);
  });

  it('builds the image prompt from the idea and the first scene description', async () => {
    const { service, foundry } = buildService({
      project: {
        id: 'proj-1',
        clientId: 'client-1',
        title: 'Launch Teaser',
        idea: 'eco water bottle launch',
        scenes: [{ title: 'Intro', description: 'a bottle on a mountain trail', durationSec: 4 }],
        step: AiVideoStep.SCRIPT,
      },
    });
    await service.render('client-1', 'proj-1', 'actor-1');

    const [prompt] = foundry.generateImage.mock.calls[0];
    expect(prompt).toContain('eco water bottle launch');
    expect(prompt).toContain('a bottle on a mountain trail');
  });

  it('falls back to the project title when there is no idea or scenes yet', async () => {
    const { service, foundry } = buildService({
      project: { id: 'proj-1', clientId: 'client-1', title: 'Launch Teaser', idea: null, scenes: null, step: AiVideoStep.IDEA },
    });
    await service.render('client-1', 'proj-1', 'actor-1');

    const [prompt] = foundry.generateImage.mock.calls[0];
    expect(prompt).toContain('Launch Teaser');
  });

  it('flags its audit log as simulated — this is a still image, not a real rendered video', async () => {
    const { service, audit } = buildService();
    await service.render('client-1', 'proj-1', 'actor-1');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ metadata: { simulated: true } }));
  });
});
