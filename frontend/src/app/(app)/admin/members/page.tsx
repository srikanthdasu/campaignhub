'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { ROLE_LABELS, ROLES, Role } from '@/lib/roles';

interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export default function MembersAdminPage() {
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('CREATOR');

  function loadMembers() {
    api
      .get<Member[]>('/users')
      .then(setMembers)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load members'));
  }

  useEffect(loadMembers, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await api.post('/users', { email, name, password, role });
      setEmail('');
      setName('');
      setPassword('');
      setRole('CREATOR');
      loadMembers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create member');
    } finally {
      setCreating(false);
    }
  }

  async function onRoleChange(id: string, newRole: Role) {
    try {
      await api.patch(`/users/${id}/role`, { role: newRole });
      loadMembers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to change role');
    }
  }

  async function onToggleActive(id: string, isActive: boolean) {
    try {
      await api.patch(`/users/${id}/active`, { isActive: !isActive });
      loadMembers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update member status');
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Members</h1>
        <p className="text-sm text-neutral-500">
          Add teammates and clients, and manage their roles. Assign them to specific clients from
          the Agency &amp; Clients page.
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={onCreate} className="space-y-3 rounded-md border border-neutral-200 p-4">
        <h2 className="text-sm font-semibold">Add a member</h2>
        <div className="grid grid-cols-2 gap-3">
          <input
            required
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            required
            type="password"
            minLength={10}
            placeholder="Temporary password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {creating ? 'Adding…' : 'Add member'}
        </button>
      </form>

      <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium">{m.name}</p>
              <p className="text-xs text-neutral-500">{m.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={m.role}
                onChange={(e) => onRoleChange(m.id, e.target.value as Role)}
                disabled={m.id === currentUser?.id}
                className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onToggleActive(m.id, m.isActive)}
                disabled={m.id === currentUser?.id}
                className={`rounded-md border px-3 py-1 text-xs font-medium ${
                  m.isActive
                    ? 'border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                    : 'border-amber-300 bg-amber-50 text-amber-700'
                } disabled:opacity-40`}
              >
                {m.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
