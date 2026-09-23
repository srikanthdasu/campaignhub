'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { RequireRole } from '@/components/require-role';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

interface AgencyRow {
  id: string;
  name: string;
  createdAt: string;
  _count: { users: number; clients: number };
}

export default function SuperAdminPage() {
  return (
    <RequireRole roles={['SUPER_ADMIN']}>
      <SuperAdminPageContent />
    </RequireRole>
  );
}

function SuperAdminPageContent() {
  const { user, switchAgency } = useAuth();
  const [agencies, setAgencies] = useState<AgencyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [pendingAgency, setPendingAgency] = useState<AgencyRow | null>(null);
  const [password, setPassword] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<AgencyRow[]>('/users/agencies')
      .then(setAgencies)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load agencies');
        setAgencies([]);
      });
  }, []);

  // Memoized — Modal's focus-trap effect re-runs whenever onClose's identity changes, and typing
  // the password re-renders this component on every keystroke. An inline arrow here would recreate
  // it each time and steal focus out of the password field after every character.
  const closeConfirm = useCallback(() => {
    setPendingAgency(null);
    setPassword('');
    setConfirmError(null);
  }, []);

  async function onConfirmSwitch(e: FormEvent) {
    e.preventDefault();
    if (!pendingAgency) return;
    setSwitchingId(pendingAgency.id);
    setConfirmError(null);
    try {
      await switchAgency(pendingAgency.id, password);
      window.location.href = '/dashboard';
    } catch (err) {
      setConfirmError(err instanceof ApiError ? err.message : 'Failed to switch agency');
      setSwitchingId(null);
    }
  }

  return (
    <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show" className="max-w-2xl space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Super Admin</h1>
        <p className="text-sm text-neutral-400">
          Switch into any agency to act as its Owner — unrestricted, no client-access grant needed.
          {user?.agencyId && <> Currently acting in agency <span className="text-neutral-300">{user.agencyId}</span>.</>}
        </p>
      </motion.div>

      {error && (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        {agencies === null ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : agencies.length === 0 ? (
          <Card padding="lg">
            <p className="text-sm text-neutral-400">No agencies found.</p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {agencies.map((agency) => (
              <li key={agency.id}>
                <Card padding="md" className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-50">{agency.name}</p>
                    <p className="mt-1 text-xs text-neutral-400">
                      {agency._count.users} member{agency._count.users === 1 ? '' : 's'} ·{' '}
                      {agency._count.clients} client{agency._count.clients === 1 ? '' : 's'} ·{' '}
                      created {new Date(agency.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={user?.agencyId === agency.id ? 'secondary' : 'primary'}
                    loading={switchingId === agency.id}
                    disabled={user?.agencyId === agency.id}
                    onClick={() => setPendingAgency(agency)}
                  >
                    {user?.agencyId === agency.id ? 'Current' : 'Switch into'}
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </motion.div>

      <Modal
        open={pendingAgency !== null}
        onClose={closeConfirm}
        title={`Switch into ${pendingAgency?.name ?? ''}`}
        size="sm"
      >
        <form onSubmit={onConfirmSwitch} className="space-y-4">
          <p className="text-sm text-neutral-400">
            Confirm your password to step into this agency&apos;s data as its Owner.
          </p>
          <Input
            label="Your password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
          {confirmError && (
            <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
              {confirmError}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={closeConfirm}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={switchingId === pendingAgency?.id}>
              Confirm switch
            </Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
