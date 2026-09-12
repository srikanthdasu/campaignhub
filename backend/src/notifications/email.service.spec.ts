import { describe, expect, it, vi } from 'vitest';
import { EmailService } from './email.service.js';
import type { ConfigService } from '@nestjs/config';

function buildConfig(values: Record<string, string | undefined>) {
  return { get: vi.fn((key: string) => values[key]) } as unknown as ConfigService;
}

describe('EmailService', () => {
  it('never throws when SMTP is not configured — it just logs instead of sending', async () => {
    const service = new EmailService(buildConfig({}));
    await expect(service.send('user@example.com', 'Subject', 'Body')).resolves.toBeUndefined();
  });

  it('does not require all four SMTP vars to avoid crashing — partial config also no-ops', async () => {
    const service = new EmailService(buildConfig({ SMTP_HOST: 'smtp.example.com' }));
    await expect(service.send('user@example.com', 'Subject', 'Body')).resolves.toBeUndefined();
  });
});
