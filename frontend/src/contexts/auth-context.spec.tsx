import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './auth-context.js';
import { api, setAccessToken } from '@/lib/api.js';

vi.mock('@/lib/api.js', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api.js')>('@/lib/api.js');
  return {
    ...actual,
    api: {
      ...actual.api,
      post: vi.fn(),
      refreshSession: vi.fn(),
    },
  };
});

function Probe() {
  const { user, status, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user?.email ?? 'none'}</span>
      <button onClick={() => login('a@b.com', 'password123')}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAccessToken(null);
  });

  it('restores an existing session on mount via refreshSession', async () => {
    vi.mocked(api.refreshSession).mockResolvedValue({
      user: { id: 'u1', email: 'restored@b.com', name: 'R', role: 'OWNER', agencyId: 'a1' },
      accessToken: 'tok',
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('restored@b.com');
  });

  it('moves to unauthenticated when there is no valid session', async () => {
    vi.mocked(api.refreshSession).mockResolvedValue(null);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
  });

  it('logs in and updates user/status from the login response', async () => {
    vi.mocked(api.refreshSession).mockResolvedValue(null);
    vi.mocked(api.post).mockResolvedValue({
      user: { id: 'u2', email: 'a@b.com', name: 'A', role: 'CREATOR', agencyId: 'a1' },
      accessToken: 'new-tok',
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));

    const user = userEvent.setup();
    await user.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('a@b.com');
    expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.com', password: 'password123' });
  });

  it('clears local session state on logout even if the server call fails', async () => {
    vi.mocked(api.refreshSession).mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com', name: 'A', role: 'OWNER', agencyId: 'a1' },
      accessToken: 'tok',
    });
    vi.mocked(api.post).mockRejectedValue(new Error('network down'));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    const user = userEvent.setup();
    await user.click(screen.getByText('logout'));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('reacts to a session dropping out from under it (e.g. a failed background silent refresh)', async () => {
    vi.mocked(api.refreshSession).mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com', name: 'A', role: 'OWNER', agencyId: 'a1' },
      accessToken: 'tok',
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    act(() => {
      setAccessToken(null);
    });

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
  });
});
