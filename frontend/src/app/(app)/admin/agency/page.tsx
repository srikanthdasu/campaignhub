'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { ROLE_LABELS, Role } from '@/lib/roles';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

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
  const [clients, setClients] = useState<Client[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [newClientName, setNewClientName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [access, setAccess] = useState<Member[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [accessLoading, setAccessLoading] = useState(false);

  function loadClients() {
    api
      .get<Client[]>('/clients')
      .then(setClients)
      .catch(() => setClients([]));
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
    <motion.div
      variants={staggerContainer(0.08)}
      initial="hidden"
      animate="show"
      className="max-w-2xl space-y-8"
    >
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          Agency &amp; clients
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Create clients and control which members can access each one.
        </p>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <Card padding="lg">
          <form onSubmit={onCreateClient} className="flex gap-3">
            <div className="flex-1">
              <Input
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="New client name"
                required
              />
            </div>
            <Button type="submit" loading={creating}>
              Add client
            </Button>
          </form>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        {clients === null ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : clients.length === 0 ? (
          <Card padding="lg">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No clients yet.</p>
          </Card>
        ) : (
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {clients.map((client) => (
                <motion.li
                  key={client.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: DURATION.base, ease: EASE_SOFT }}
                >
                  <Card padding="none" className="overflow-hidden">
                    <button
                      onClick={() => toggleClient(client.id)}
                      className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-neutral-900 dark:text-neutral-50"
                    >
                      {client.name}
                      <span className="text-xs font-normal text-accent-600 dark:text-accent-400">
                        {expandedClientId === client.id ? 'Hide access' : 'Manage access'}
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {expandedClientId === client.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: DURATION.base, ease: EASE_SOFT }}
                          className="overflow-hidden border-t border-neutral-100 dark:border-neutral-800"
                        >
                          <div className="space-y-3 px-5 py-4">
                            {accessLoading ? (
                              <Skeleton className="h-6 w-40" />
                            ) : (
                              <ul className="space-y-2">
                                {access.length === 0 && (
                                  <li className="text-xs text-neutral-500 dark:text-neutral-400">
                                    No members assigned yet. Owners and Admins always have full
                                    access.
                                  </li>
                                )}
                                <AnimatePresence initial={false}>
                                  {access.map((m) => (
                                    <motion.li
                                      key={m.id}
                                      initial={{ opacity: 0, x: -8 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      exit={{ opacity: 0, x: 8 }}
                                      transition={{ duration: DURATION.fast, ease: EASE_SOFT }}
                                      className="flex items-center justify-between text-xs"
                                    >
                                      <span className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
                                        {m.name} <Badge tone="neutral">{ROLE_LABELS[m.role]}</Badge>
                                      </span>
                                      <button
                                        onClick={() => onRevoke(client.id, m.id)}
                                        className="font-medium text-red-600 hover:underline dark:text-red-400"
                                      >
                                        Remove
                                      </button>
                                    </motion.li>
                                  ))}
                                </AnimatePresence>
                              </ul>
                            )}

                            <div className="flex gap-2 pt-2">
                              <div className="flex-1">
                                <Select
                                  value={selectedUserId}
                                  onChange={(e) => setSelectedUserId(e.target.value)}
                                >
                                  <option value="">Select a member…</option>
                                  {members
                                    .filter((m) => !access.some((a) => a.id === m.id))
                                    .map((m) => (
                                      <option key={m.id} value={m.id}>
                                        {m.name} ({ROLE_LABELS[m.role]})
                                      </option>
                                    ))}
                                </Select>
                              </div>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => onGrant(client.id)}
                              >
                                Grant access
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </motion.div>
    </motion.div>
  );
}
