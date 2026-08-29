'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

interface AuditEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; role: string } | null;
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<AuditEntry[]>('/audit-logs')
      .then(setEntries)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load audit log'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Security &amp; audit</h1>
        <p className="text-sm text-neutral-500">
          Recent security-relevant activity across your agency.
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-neutral-500">Loading…</p>}

      <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
        {!loading && entries.length === 0 && (
          <li className="px-4 py-3 text-sm text-neutral-500">No activity yet.</li>
        )}
        {entries.map((entry) => (
          <li key={entry.id} className="px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{entry.action}</span>
              <span className="text-xs text-neutral-400">
                {new Date(entry.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              {entry.user ? `${entry.user.name} (${entry.user.email})` : 'System'}
              {entry.entityType ? ` · ${entry.entityType}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
