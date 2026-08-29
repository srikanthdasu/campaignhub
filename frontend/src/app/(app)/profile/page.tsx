'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { ROLE_LABELS, Role } from '@/lib/roles';

interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  notificationPrefs: { emailOnApproval?: boolean } | null;
  createdAt: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [emailOnApproval, setEmailOnApproval] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Profile>('/users/me')
      .then((p) => {
        setProfile(p);
        setName(p.name);
        setEmailOnApproval(p.notificationPrefs?.emailOnApproval ?? true);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.patch<Profile>('/users/me', {
        name,
        notificationPrefs: { emailOnApproval },
      });
      setProfile(updated);
      setMessage('Profile updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (!profile) return <p className="text-sm text-red-600">{error ?? 'Profile not found'}</p>;

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Your profile</h1>
        <p className="text-sm text-neutral-500">{profile.email}</p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {message && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
        </div>

        <div className="space-y-1">
          <span className="text-sm font-medium">Role</span>
          <p className="text-sm text-neutral-500">{ROLE_LABELS[profile.role]}</p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={emailOnApproval}
            onChange={(e) => setEmailOnApproval(e.target.checked)}
          />
          Email me when content needs my approval
        </label>

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
