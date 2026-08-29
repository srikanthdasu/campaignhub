'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { ROLE_LABELS, Role } from '@/lib/roles';

interface Client {
  id: string;
  name: string;
  createdAt: string;
}

interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export default function AgencyAdminPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [newClientName, setNewClientName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [access, setAccess] = useState<Member[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [accessLoading, setAccessLoading] = useState(false);

  function loadClients() {
    api.get<Client[]>('/clients').then(setClients).catch(() => {});
  }

  useEffect(() => {
    loadClients();
    api.get<Member[]>('/users').then(setMembers).catch(() => {});
  }, []);

  async function onCreateClient(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await api.post('/clients', { name: newClientName });
      setNewClientName('');
      loadClients();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create client');
    } finally {
      setCreating(false);
    }
  }

  async function toggleClient(clientId: string) {
    if (expandedClientId === clientId) {
      setExpandedClientId(null);
      return;
    }
    setExpandedClientId(clientId);
    setAccessLoading(true);
    try {
      const list = await api.get<Member[]>(`/clients/${clientId}/access`);
      setAccess(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load client access');
    } finally {
      setAccessLoading(false);
    }
  }

  async function onGrant(clientId: string) {
    if (!selectedUserId) return;
    try {
      await api.post(`/clients/${clientId}/access`, { userId: selectedUserId });
      const list = await api.get<Member[]>(`/clients/${clientId}/access`);
      setAccess(list);
      setSelectedUserId('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to grant access');
    }
  }

  async function onRevoke(clientId: string, userId: string) {
    try {
      await api.delete(`/clients/${clientId}/access/${userId}`);
      setAccess((prev) => prev.filter((m) => m.id !== userId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to revoke access');
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Agency &amp; clients</h1>
        <p className="text-sm text-neutral-500">
          Create clients and control which members can access each one.
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={onCreateClient} className="flex gap-2">
        <input
          value={newClientName}
          onChange={(e) => setNewClientName(e.target.value)}
          placeholder="New client name"
          required
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Add client
        </button>
      </form>

      <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
        {clients.length === 0 && (
          <li className="px-4 py-3 text-sm text-neutral-500">No clients yet.</li>
        )}
        {clients.map((client) => (
          <li key={client.id} className="px-4 py-3">
            <button
              onClick={() => toggleClient(client.id)}
              className="flex w-full items-center justify-between text-left text-sm font-medium"
            >
              {client.name}
              <span className="text-neutral-400">
                {expandedClientId === client.id ? 'Hide access' : 'Manage access'}
              </span>
            </button>

            {expandedClientId === client.id && (
              <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
                {accessLoading ? (
                  <p className="text-xs text-neutral-500">Loading…</p>
                ) : (
                  <ul className="space-y-1">
                    {access.length === 0 && (
                      <li className="text-xs text-neutral-500">
                        No members assigned yet. Owners and Admins always have full access.
                      </li>
                    )}
                    {access.map((m) => (
                      <li key={m.id} className="flex items-center justify-between text-xs">
                        <span>
                          {m.name} ({ROLE_LABELS[m.role]})
                        </span>
                        <button
                          onClick={() => onRevoke(client.id, m.id)}
                          className="text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex gap-2 pt-2">
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-xs"
                  >
                    <option value="">Select a member…</option>
                    {members
                      .filter((m) => !access.some((a) => a.id === m.id))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({ROLE_LABELS[m.role]})
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => onGrant(client.id)}
                    className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium hover:bg-neutral-100"
                  >
                    Grant access
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
