import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useClientPicker } from './use-client-picker.js';
import { api } from '@/lib/api.js';

vi.mock('@/lib/api.js', () => ({ api: { get: vi.fn() } }));

describe('useClientPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-selects the first client once the list loads', async () => {
    vi.mocked(api.get).mockResolvedValue([
      { id: 'c1', name: 'Client One' },
      { id: 'c2', name: 'Client Two' },
    ]);

    const { result } = renderHook(() => useClientPicker());

    await waitFor(() => expect(result.current.clients).toHaveLength(2));
    expect(result.current.selectedClientId).toBe('c1');
  });

  it('falls back to an empty list when the request fails, without throwing', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useClientPicker());

    await waitFor(() => expect(result.current.clients).toEqual([]));
    expect(result.current.selectedClientId).toBe('');
  });

  it('does not clobber a manually chosen selection when the list re-fetches', async () => {
    vi.mocked(api.get).mockResolvedValue([{ id: 'c1', name: 'Client One' }]);
    const { result } = renderHook(() => useClientPicker());
    await waitFor(() => expect(result.current.clients).toHaveLength(1));

    result.current.setSelectedClientId('picked-by-user');
    await waitFor(() => expect(result.current.selectedClientId).toBe('picked-by-user'));
  });
});
