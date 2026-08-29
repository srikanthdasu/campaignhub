'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { isAgencyAdmin, Role } from '@/lib/roles';

interface Agency {
  id: string;
  name: string;
  plan: string;
  subscriptionStatus: string;
  settings: { timezone?: string; brandColor?: string } | null;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const admin = isAgencyAdmin(user?.role as Role | undefined);

  const [agency, setAgency] = useState<Agency | null>(null);
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [brandColor, setBrandColor] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Agency>('/agencies/me')
      .then((a) => {
        setAgency(a);
        setName(a.name);
        setTimezone(a.settings?.timezone ?? '');
        setBrandColor(a.settings?.brandColor ?? '');
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load agency'))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.patch<Agency>('/agencies/me/settings', {
        name,
        settings: { timezone, brandColor },
      });
      setAgency(updated);
      setMessage('Settings saved.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (!agency) return <p className="text-sm text-red-600">{error ?? 'Agency not found'}</p>;

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Agency settings</h1>
        <p className="text-sm text-neutral-500">
          Plan: {agency.plan} · {agency.subscriptionStatus}
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {message && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
      )}

      {!admin ? (
        <p className="text-sm text-neutral-600">
          Agency name: <span className="font-medium">{agency.name}</span>
          <br />
          Only Owners and Admins can change agency settings.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="agencyName">
              Agency name
            </label>
            <input
              id="agencyName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="timezone">
              Timezone
            </label>
            <input
              id="timezone"
              placeholder="Asia/Kolkata"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="brandColor">
              Brand color
            </label>
            <input
              id="brandColor"
              placeholder="#1D4ED8"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      )}
    </div>
  );
}
