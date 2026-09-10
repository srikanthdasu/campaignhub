'use client';

import { FormEvent, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { ROLE_LABELS, ROLES, Role } from '@/lib/roles';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import { Users, UserPlus, Building2, UserX, BarChart3, type LucideIcon } from 'lucide-react';

const CLIENT_GROUP_ROLES = ['MANAGER', 'APPROVER', 'VIEWER'] as const;
type ClientGroupRole = (typeof CLIENT_GROUP_ROLES)[number];

const CLIENT_GROUP_ROLE_LABELS: Record<ClientGroupRole, string> = {
  MANAGER: 'Manager',
  APPROVER: 'Approver',
  VIEWER: 'Viewer',
};

interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

interface ClientTeamMember extends Member {
  accessRole: ClientGroupRole;
}

interface ClientGroup {
  id: string;
  name: string;
  members: ClientTeamMember[];
}

interface AccessOverview {
  totalClients: number;
  totalMembers: number;
  unassignedCount: number;
  clients: ClientGroup[];
  unassigned: Member[];
}

function PanelHeader({ n, title, icon: Icon, color }: { n: number; title: string; icon: LucideIcon; color: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-3">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {n}
      </span>
      <Icon className="h-4 w-4 shrink-0" style={{ color }} strokeWidth={2} />
      <h2 className="text-sm font-semibold text-neutral-50">{title}</h2>
    </div>
  );
}

export default function MembersAdminPage() {
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [overview, setOverview] = useState<AccessOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('CREATOR');

  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const [assignUserId, setAssignUserId] = useState<Record<string, string>>({});
  const [assignRole, setAssignRole] = useState<Record<string, ClientGroupRole>>({});
  const [assigning, setAssigning] = useState<string | null>(null);
  const [quickAssignClientId, setQuickAssignClientId] = useState<Record<string, string>>({});

  function loadMembers() {
    api
      .get<Member[]>('/users')
      .then(setMembers)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load members'));
  }

  function loadOverview() {
    api
      .get<AccessOverview>('/clients/access-overview')
      .then(setOverview)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load client teams'));
  }

  useEffect(() => {
    loadMembers();
    loadOverview();
  }, []);

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
      loadOverview();
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
      loadOverview();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update member status');
    }
  }

  async function onResetPassword(id: string) {
    if (!resetPassword) return;
    setResetting(true);
    setError(null);
    try {
      await api.patch(`/users/${id}/password`, { newPassword: resetPassword });
      setResettingId(null);
      setResetPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  }

  async function onGrantTeamAccess(clientId: string) {
    const userId = assignUserId[clientId];
    if (!userId) return;
    const grantRole = assignRole[clientId] ?? 'VIEWER';
    setAssigning(clientId);
    setError(null);
    try {
      await api.post(`/clients/${clientId}/access`, { userId, role: grantRole });
      setAssignUserId((p) => ({ ...p, [clientId]: '' }));
      loadOverview();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add member to team');
    } finally {
      setAssigning(null);
    }
  }

  async function onQuickAssign(userId: string) {
    const clientId = quickAssignClientId[userId];
    if (!clientId) return;
    setAssigning(userId);
    setError(null);
    try {
      await api.post(`/clients/${clientId}/access`, { userId, role: 'VIEWER' });
      setQuickAssignClientId((p) => ({ ...p, [userId]: '' }));
      loadOverview();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to assign member');
    } finally {
      setAssigning(null);
    }
  }

  async function onTeamRoleChange(clientId: string, userId: string, newRole: ClientGroupRole) {
    setError(null);
    try {
      await api.patch(`/clients/${clientId}/access/${userId}`, { role: newRole });
      loadOverview();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to change team role');
    }
  }

  async function onRemoveFromTeam(clientId: string, userId: string) {
    setError(null);
    try {
      await api.delete(`/clients/${clientId}/access/${userId}`);
      loadOverview();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove member from team');
    }
  }

  return (
    <motion.div variants={staggerContainer(0.06)} initial="hidden" animate="show" className="max-w-[1400px] space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Members</h1>
        <p className="text-sm text-neutral-400">
          Manage agency-wide accounts, then organize who&apos;s on each client&apos;s team and what they can do
          there.
        </p>
      </motion.div>

      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300"
        >
          {error}
        </motion.p>
      )}

      <motion.div
        variants={fadeUp}
        transition={{ duration: DURATION.base, ease: EASE_SOFT }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {/* 1. All Members */}
        <Card padding="lg">
          <PanelHeader n={1} title="All Members" icon={Users} color="#0ea5e9" />
          {members === null ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {members.map((m) => (
                <div key={m.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-neutral-50">{m.name}</p>
                      <p className="truncate text-[11px] text-neutral-500">{m.email}</p>
                    </div>
                    <Badge tone={m.isActive ? 'success' : 'neutral'}>{m.isActive ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <Select
                      value={m.role}
                      onChange={(e) => onRoleChange(m.id, e.target.value as Role)}
                      disabled={m.id === currentUser?.id}
                      className="flex-1 py-1 text-[11px]"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </Select>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setResettingId(resettingId === m.id ? null : m.id)}
                    >
                      Reset
                    </Button>
                    <Button
                      variant={m.isActive ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={() => onToggleActive(m.id, m.isActive)}
                      disabled={m.id === currentUser?.id}
                    >
                      {m.isActive ? 'Off' : 'On'}
                    </Button>
                  </div>
                  {resettingId === m.id && (
                    <div className="mt-2 flex items-end gap-1.5 border-t border-white/10 pt-2">
                      <Input
                        type="password"
                        placeholder="New password (10+ chars)"
                        minLength={10}
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        className="flex-1 py-1 text-xs"
                      />
                      <Button
                        size="sm"
                        loading={resetting}
                        disabled={resetPassword.length < 10}
                        onClick={() => onResetPassword(m.id)}
                      >
                        Set
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {members.length === 0 && <p className="text-xs text-neutral-500">No members yet.</p>}
            </div>
          )}
        </Card>

        {/* 2. Add Member */}
        <Card padding="lg">
          <PanelHeader n={2} title="Add Member" icon={UserPlus} color="#10b981" />
          <form onSubmit={onCreate} className="space-y-2">
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
            <Button type="submit" size="sm" className="w-full" loading={creating}>
              {creating ? 'Adding…' : 'Add member'}
            </Button>
            <p className="text-[11px] text-neutral-500">
              New members start with no client team assignments — add them to a client&apos;s team in the panel
              on the right.
            </p>
          </form>
        </Card>

        {/* 3. Overview */}
        <Card padding="lg">
          <PanelHeader n={3} title="Overview" icon={BarChart3} color="#f59e0b" />
          {overview === null ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                <span className="text-neutral-400">Total members</span>
                <span className="font-semibold text-neutral-50">{overview.totalMembers}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                <span className="text-neutral-400">Clients with teams</span>
                <span className="font-semibold text-neutral-50">{overview.totalClients}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                <span className="text-neutral-400">Not on any client team</span>
                <span className="font-semibold text-neutral-50">{overview.unassignedCount}</span>
              </div>
              <p className="pt-1 text-[11px] text-neutral-500">
                A member&apos;s role here (e.g. Owner, Creator) is agency-wide. Their role on a specific client&apos;s
                team — Manager, Approver, or Viewer — is set per client in the panel below and can differ across
                clients.
              </p>
            </div>
          )}
        </Card>

        {/* 4. Client Teams (grouped by client, with per-client roles) */}
        <Card padding="lg" className="sm:col-span-2 xl:col-span-2">
          <PanelHeader n={4} title="Client Teams" icon={Building2} color="#8b5cf6" />
          {overview === null ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : overview.clients.length === 0 ? (
            <p className="text-xs text-neutral-500">No clients yet — create one from Agency &amp; Clients.</p>
          ) : (
            <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
              {overview.clients.map((c) => {
                const availableToAdd = members?.filter((m) => !c.members.some((cm) => cm.id === m.id)) ?? [];
                return (
                  <div key={c.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium text-neutral-50">{c.name}</p>
                      <Badge tone="neutral">
                        {c.members.length} member{c.members.length === 1 ? '' : 's'}
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      {c.members.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs text-neutral-200">{m.name}</p>
                            <p className="truncate text-[10px] text-neutral-500">
                              {ROLE_LABELS[m.role]} · {m.email}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Select
                              value={m.accessRole}
                              onChange={(e) => onTeamRoleChange(c.id, m.id, e.target.value as ClientGroupRole)}
                              className="py-1 text-[11px]"
                            >
                              {CLIENT_GROUP_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {CLIENT_GROUP_ROLE_LABELS[r]}
                                </option>
                              ))}
                            </Select>
                            <button
                              onClick={() => onRemoveFromTeam(c.id, m.id)}
                              className="rounded px-1.5 py-1 text-[10px] font-medium text-red-400 hover:bg-red-500/10"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                      {c.members.length === 0 && (
                        <p className="text-[11px] text-neutral-500">No one on this team yet.</p>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 border-t border-white/10 pt-2">
                      <Select
                        value={assignUserId[c.id] ?? ''}
                        onChange={(e) => setAssignUserId((p) => ({ ...p, [c.id]: e.target.value }))}
                        className="flex-1 py-1 text-[11px]"
                      >
                        <option value="">Add member…</option>
                        {availableToAdd.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </Select>
                      <Select
                        value={assignRole[c.id] ?? 'VIEWER'}
                        onChange={(e) =>
                          setAssignRole((p) => ({ ...p, [c.id]: e.target.value as ClientGroupRole }))
                        }
                        className="w-28 py-1 text-[11px]"
                      >
                        {CLIENT_GROUP_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {CLIENT_GROUP_ROLE_LABELS[r]}
                          </option>
                        ))}
                      </Select>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!assignUserId[c.id] || assigning === c.id}
                        onClick={() => onGrantTeamAccess(c.id)}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* 5. Unassigned Members */}
        <Card padding="lg">
          <PanelHeader n={5} title="Not on a Client Team" icon={UserX} color="#f43f5e" />
          {overview === null ? (
            <Skeleton className="h-20 w-full rounded-xl" />
          ) : overview.unassigned.length === 0 ? (
            <p className="text-xs text-neutral-500">Every member is on at least one client team.</p>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {overview.unassigned.map((m) => (
                <div key={m.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                  <p className="truncate text-xs font-medium text-neutral-50">{m.name}</p>
                  <p className="truncate text-[11px] text-neutral-500">
                    {ROLE_LABELS[m.role]} · {m.email}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <Select
                      value={quickAssignClientId[m.id] ?? ''}
                      onChange={(e) => setQuickAssignClientId((p) => ({ ...p, [m.id]: e.target.value }))}
                      className="flex-1 py-1 text-[11px]"
                    >
                      <option value="">Assign to client…</option>
                      {overview.clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!quickAssignClientId[m.id] || assigning === m.id}
                      onClick={() => onQuickAssign(m.id)}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
