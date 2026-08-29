'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { ROLE_LABELS, ROLES, Role } from '@/lib/roles';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export default function MembersAdminPage() {
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState<Member[] | null>(null);
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
    <motion.div
      variants={staggerContainer(0.08)}
      initial="hidden"
      animate="show"
      className="max-w-2xl space-y-8"
    >
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Members</h1>
        <p className="text-sm text-neutral-400">
          Add teammates and clients, and manage their roles. Assign them to specific clients from
          the Agency &amp; Clients page.
        </p>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <Card padding="lg">
          <h2 className="mb-4 text-sm font-semibold text-neutral-50">Add a member</h2>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input required placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input
                required
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                required
                type="password"
                minLength={10}
                placeholder="Temporary password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" loading={creating}>
              {creating ? 'Adding…' : 'Add member'}
            </Button>
          </form>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        {members === null ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : (
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {members.map((m) => (
                <motion.li
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: DURATION.base, ease: EASE_SOFT }}
                >
                  <Card padding="md" className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-50">{m.name}</p>
                      <p className="text-xs text-neutral-400">{m.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={m.role}
                        onChange={(e) => onRoleChange(m.id, e.target.value as Role)}
                        disabled={m.id === currentUser?.id}
                        className="py-1.5 text-xs"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </Select>
                      <Button
                        variant={m.isActive ? 'secondary' : 'primary'}
                        size="sm"
                        onClick={() => onToggleActive(m.id, m.isActive)}
                        disabled={m.id === currentUser?.id}
                      >
                        {m.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
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
