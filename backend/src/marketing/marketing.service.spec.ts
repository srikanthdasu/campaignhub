import { describe, expect, it, vi } from 'vitest';
import { MarketingService } from './marketing.service.js';
import type { ConfigService } from '@nestjs/config';
import type { EmailService } from '../notifications/email.service.js';

function buildService() {
  const email = { send: vi.fn((_to: string, _subject: string, _body: string) => Promise.resolve(true)) };
  const config = {
    getOrThrow: vi.fn((key: string) =>
      key === 'DEMO_REQUEST_EMAIL' ? 'owner@sreematechhub.com' : 'https://app.example.com',
    ),
  };
  const service = new MarketingService(config as unknown as ConfigService, email as unknown as EmailService);
  return { service, email, config };
}

describe('MarketingService.requestDemo', () => {
  it('emails the configured notify address with the submitted details', async () => {
    const { service, email } = buildService();

    await service.requestDemo('Priya Sharma', 'priya@agency.com', 'Sunrise Media', 'Interested in the Pro plan');

    expect(email.send).toHaveBeenCalledWith(
      'owner@sreematechhub.com',
      expect.stringContaining('Priya Sharma'),
      expect.stringContaining('Sunrise Media'),
    );
  });

  it('also sends a confirmation email to the submitter', async () => {
    const { service, email } = buildService();

    await service.requestDemo('Priya Sharma', 'priya@agency.com');

    expect(email.send).toHaveBeenCalledWith(
      'priya@agency.com',
      expect.stringContaining('demo request'),
      expect.stringContaining('https://app.example.com'),
    );
  });

  it('omits the agency/message lines entirely when not provided', async () => {
    const { service, email } = buildService();

    await service.requestDemo('Priya Sharma', 'priya@agency.com');

    const notifyCall = email.send.mock.calls.find((c) => c[0] === 'owner@sreematechhub.com');
    expect(notifyCall?.[2]).not.toContain('Agency:');
    expect(notifyCall?.[2]).not.toContain('Message:');
  });
});
