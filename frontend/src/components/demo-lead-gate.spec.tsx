import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoLeadGate } from './demo-lead-gate.js';
import { api } from '@/lib/api.js';
import { useAuth } from '@/contexts/auth-context.js';

vi.mock('@/lib/api.js', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api.js')>('@/lib/api.js');
  return { ...actual, api: { ...actual.api, post: vi.fn() } };
});

vi.mock('@/contexts/auth-context.js', () => ({ useAuth: vi.fn() }));

function mockUser(email: string | undefined) {
  vi.mocked(useAuth).mockReturnValue({
    user: email ? ({ id: 'u1', email, name: 'Test', role: 'OWNER', agencyId: 'a1' } as any) : null,
  } as any);
}

describe('DemoLeadGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('renders nothing for a logged-out visitor', () => {
    mockUser(undefined);
    render(<DemoLeadGate />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders nothing for a real (non-demo) account', () => {
    mockUser('owner@realagency.com');
    render(<DemoLeadGate />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('prompts the demo account for their name and email', () => {
    mockUser('demo@campaignhubai.app');
    render(<DemoLeadGate />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Your name')).toBeInTheDocument();
    expect(screen.getByLabelText('Your email')).toBeInTheDocument();
  });

  it('does not prompt again once this browser has already captured a lead', () => {
    window.localStorage.setItem('demo-lead-captured', '1');
    mockUser('demo@campaignhubai.app');
    render(<DemoLeadGate />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Regression test for a real bug that shipped: onClose={() => {}} was a fresh function on
  // every render, and Modal's focus-trap effect re-runs whenever onClose's identity changes —
  // so every keystroke re-ran it and yanked focus out of the field, letting through only one
  // character at a time before the user had to click back in.
  it('keeps focus in the name field across a full run of continuous typing', async () => {
    mockUser('demo@campaignhubai.app');
    render(<DemoLeadGate />);
    const user = userEvent.setup();

    const nameInput = screen.getByLabelText('Your name') as HTMLInputElement;
    await user.click(nameInput);
    await user.keyboard('Priya Sharma');

    expect(nameInput).toHaveValue('Priya Sharma');
    expect(nameInput).toHaveFocus();
  });

  it('keeps focus in the email field across a full run of continuous typing', async () => {
    mockUser('demo@campaignhubai.app');
    render(<DemoLeadGate />);
    const user = userEvent.setup();

    const emailInput = screen.getByLabelText('Your email') as HTMLInputElement;
    await user.click(emailInput);
    await user.keyboard('priya@example.com');

    expect(emailInput).toHaveValue('priya@example.com');
    expect(emailInput).toHaveFocus();
  });

  it('the close button does not dismiss it — the intro is required, not skippable', async () => {
    mockUser('demo@campaignhubai.app');
    render(<DemoLeadGate />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('submits the captured lead and marks this browser as done', async () => {
    mockUser('demo@campaignhubai.app');
    vi.mocked(api.post).mockResolvedValue({});
    render(<DemoLeadGate />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Your name'), 'Priya Sharma');
    await user.type(screen.getByLabelText('Your email'), 'priya@example.com');
    await user.click(screen.getByRole('button', { name: 'Continue to the demo' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/demo-leads', {
        name: 'Priya Sharma',
        email: 'priya@example.com',
      }),
    );
    await waitFor(() => expect(window.localStorage.getItem('demo-lead-captured')).toBe('1'));
  });
});
