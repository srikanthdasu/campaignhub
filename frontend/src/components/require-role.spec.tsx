import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RequireRole } from './require-role.js';
import { useAuth } from '@/contexts/auth-context.js';
import { useRouter } from 'next/navigation';

vi.mock('@/contexts/auth-context.js', () => ({ useAuth: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));

function mockUser(role: string | undefined) {
  vi.mocked(useAuth).mockReturnValue({
    user: role ? ({ id: 'u1', email: 'a@b.com', name: 'A', role, agencyId: 'a1' } as any) : null,
  } as any);
}

describe('RequireRole', () => {
  const replace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({ replace } as any);
  });

  it('renders its children when the user has an allowed role', () => {
    mockUser('OWNER');
    render(
      <RequireRole roles={['OWNER', 'ADMIN']}>
        <div>Protected content</div>
      </RequireRole>,
    );
    expect(screen.getByText('Protected content')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('renders nothing and redirects a disallowed role to the dashboard', () => {
    mockUser('CREATOR');
    render(
      <RequireRole roles={['OWNER', 'ADMIN']}>
        <div>Protected content</div>
      </RequireRole>,
    );
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/dashboard');
  });

  // A CLIENT-role user's real home is the client portal, not the agency dashboard — sending
  // them to /dashboard would just bounce them straight into another RequireRole redirect.
  it('sends a disallowed CLIENT to the client portal instead of the dashboard', () => {
    mockUser('CLIENT');
    render(
      <RequireRole roles={['OWNER', 'ADMIN']}>
        <div>Protected content</div>
      </RequireRole>,
    );
    expect(replace).toHaveBeenCalledWith('/client-portal');
  });

  it('renders nothing but does not redirect while there is no user yet', () => {
    mockUser(undefined);
    render(
      <RequireRole roles={['OWNER', 'ADMIN']}>
        <div>Protected content</div>
      </RequireRole>,
    );
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
