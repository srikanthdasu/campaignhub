'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { api, ApiError, resolveMediaUrl } from '@/lib/api';
import { ROLE_LABELS, ROLES, Role } from '@/lib/roles';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import {
  LayoutList,
  UserPlus,
  ClipboardList,
  Send,
  Link2,
  Palette,
  ClipboardCheck,
  CheckCircle2,
  Copy,
  type LucideIcon,
} from 'lucide-react';

const PLANS = ['BASIC', 'PRO', 'BUSINESS', 'ENTERPRISE', 'CUSTOM'] as const;
const STATUSES = ['ACTIVE', 'PENDING_ONBOARDING', 'INACTIVE', 'BLOCKED'] as const;
type ClientPlan = (typeof PLANS)[number];
type ClientStatus = (typeof STATUSES)[number];

const STATUS_TONE: Record<ClientStatus, 'accent' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  ACTIVE: 'success',
  PENDING_ONBOARDING: 'warning',
  INACTIVE: 'neutral',
  BLOCKED: 'danger',
};

const STATUS_LABELS: Record<ClientStatus, string> = {
  ACTIVE: 'Active',
  PENDING_ONBOARDING: 'Pending onboarding',
  INACTIVE: 'Inactive',
  BLOCKED: 'Blocked',
};

interface Client {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
  website: string | null;
  businessType: string | null;
  industry: string | null;
  address: string | null;
  timeZone: string | null;
  currency: string | null;
  defaultLanguage: string | null;
  allowClientPortalAccess: boolean;
  notes: string | null;
  plan: ClientPlan;
  status: ClientStatus;
  createdAt: string;
}

interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface BrandKit {
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  voiceGuidelines: string | null;
  aiContext: string | null;
}

const EMPTY_BRAND_KIT: BrandKit = {
  logoUrl: null,
  primaryColor: '',
  secondaryColor: '',
  voiceGuidelines: '',
  aiContext: '',
};

interface DetailsForm {
  businessType: string;
  industry: string;
  address: string;
  timeZone: string;
  currency: string;
  defaultLanguage: string;
  allowClientPortalAccess: boolean;
  notes: string;
  plan: ClientPlan;
  status: ClientStatus;
}

function toDetailsForm(client: Client): DetailsForm {
  return {
    businessType: client.businessType ?? '',
    industry: client.industry ?? '',
    address: client.address ?? '',
    timeZone: client.timeZone ?? '',
    currency: client.currency ?? '',
    defaultLanguage: client.defaultLanguage ?? '',
    allowClientPortalAccess: client.allowClientPortalAccess,
    notes: client.notes ?? '',
    plan: client.plan,
    status: client.status,
  };
}

function generatePassword(): string {
  // Excludes visually ambiguous characters (0/O, 1/l/I) since this gets read and typed by a
  // human off-screen — length comfortably clears the backend's 10-character minimum.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let pwd = '';
  for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

interface CreatedCredential {
  id: string;
  name: string;
  email: string;
  role: Role;
  password: string;
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

export default function AgencyAdminPage() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [search, setSearch] = useState('');
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [access, setAccess] = useState<Member[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const [newClient, setNewClient] = useState({
    name: '',
    contactName: '',
    contactEmail: '',
    phone: '',
    website: '',
    plan: 'BASIC' as ClientPlan,
  });
  const [creatingClient, setCreatingClient] = useState(false);

  const [details, setDetails] = useState<DetailsForm | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);

  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('CLIENT');
  const [inviting, setInviting] = useState(false);
  const [credentials, setCredentials] = useState<CreatedCredential[]>([]);

  const [socialCount, setSocialCount] = useState<number | null>(null);

  const [brandKit, setBrandKit] = useState<BrandKit>(EMPTY_BRAND_KIT);
  const [savingBrandKit, setSavingBrandKit] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

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

  async function selectClient(client: Client) {
    setActiveClientId(client.id);
    setActiveClient(client);
    setDetails(toDetailsForm(client));
    setCredentials([]);
    setSocialCount(null);
    setError(null);
    try {
      const [accessList, kit, accounts] = await Promise.all([
        api.get<Member[]>(`/clients/${client.id}/access`),
        api.get<BrandKit | null>(`/clients/${client.id}/brand-kit`),
        api.get<unknown[]>(`/clients/${client.id}/social-accounts`),
      ]);
      setAccess(accessList);
      setBrandKit({
        logoUrl: kit?.logoUrl ?? null,
        primaryColor: kit?.primaryColor ?? '',
        secondaryColor: kit?.secondaryColor ?? '',
        voiceGuidelines: kit?.voiceGuidelines ?? '',
        aiContext: kit?.aiContext ?? '',
      });
      setSocialCount(accounts.length);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load client data');
    }
  }

  async function onCreateClient(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatingClient(true);
    try {
      const client = await api.post<Client>('/clients', newClient);
      setNewClient({ name: '', contactName: '', contactEmail: '', phone: '', website: '', plan: 'BASIC' });
      loadClients();
      await selectClient(client);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create client');
    } finally {
      setCreatingClient(false);
    }
  }

  async function onSaveDetails() {
    if (!activeClientId || !details) return;
    setSavingDetails(true);
    setError(null);
    try {
      const updated = await api.patch<Client>(`/clients/${activeClientId}`, details);
      setActiveClient(updated);
      setClients((prev) => prev?.map((c) => (c.id === activeClientId ? updated : c)) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save client details');
    } finally {
      setSavingDetails(false);
    }
  }

  async function onInviteUser() {
    if (!activeClientId || !inviteEmail.trim() || !inviteName.trim()) return;
    setInviting(true);
    setError(null);
    try {
      const password = generatePassword();
      const created = await api.post<{ id: string }>('/users', {
        email: inviteEmail.trim(),
        name: inviteName.trim(),
        password,
        role: inviteRole,
        clientIds: [activeClientId],
      });
      setCredentials((prev) => [
        ...prev,
        { id: created.id, name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole, password },
      ]);
      setAccess((prev) => [...prev, { id: created.id, name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole }]);
      setInviteName('');
      setInviteEmail('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create user');
    } finally {
      setInviting(false);
    }
  }

  async function onGrantExisting() {
    if (!activeClientId || !selectedUserId) return;
    try {
      await api.post(`/clients/${activeClientId}/access`, { userId: selectedUserId });
      const list = await api.get<Member[]>(`/clients/${activeClientId}/access`);
      setAccess(list);
      setSelectedUserId('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to grant access');
    }
  }

  async function onRevoke(userId: string) {
    if (!activeClientId) return;
    try {
      await api.delete(`/clients/${activeClientId}/access/${userId}`);
      setAccess((prev) => prev.filter((m) => m.id !== userId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to revoke access');
    }
  }

  async function onUploadLogo(file: File) {
    if (!activeClientId) return;
    setUploadingLogo(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('folder', 'logos');
      const asset = await api.upload<{ storageUrl: string }>(`/clients/${activeClientId}/media`, form);
      const updatedKit = await api.put<BrandKit>(`/clients/${activeClientId}/brand-kit`, {
        ...brandKit,
        logoUrl: asset.storageUrl,
      });
      setBrandKit(updatedKit);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function onSaveBrandKit() {
    if (!activeClientId) return;
    setSavingBrandKit(true);
    setError(null);
    try {
      const updated = await api.put<BrandKit>(`/clients/${activeClientId}/brand-kit`, brandKit);
      setBrandKit(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save brand kit');
    } finally {
      setSavingBrandKit(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  const CSV_COLUMNS = ['name', 'contactName', 'contactEmail', 'phone', 'website', 'businessType', 'industry', 'plan'] as const;

  function csvEscape(value: string): string {
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }

  function onExportCsv() {
    if (!clients?.length) return;
    const rows = [
      CSV_COLUMNS.join(','),
      ...clients.map((c) => CSV_COLUMNS.map((col) => csvEscape(String(c[col as keyof Client] ?? ''))).join(',')),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clients.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function parseCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cells.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current);
    return cells;
  }

  async function onImportCsv(file: File) {
    setImporting(true);
    setError(null);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) throw new Error('CSV has no data rows');
      const header = parseCsvLine(lines[0]).map((h) => h.trim());
      for (const line of lines.slice(1)) {
        const cells = parseCsvLine(line);
        const row: Record<string, string> = {};
        header.forEach((h, i) => (row[h] = cells[i] ?? ''));
        if (!row.name) continue;
        await api.post('/clients', {
          name: row.name,
          contactName: row.contactName || undefined,
          contactEmail: row.contactEmail || undefined,
          phone: row.phone || undefined,
          website: row.website || undefined,
          businessType: row.businessType || undefined,
          industry: row.industry || undefined,
          plan: PLANS.includes(row.plan as ClientPlan) ? row.plan : undefined,
        });
      }
      loadClients();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to import CSV');
    } finally {
      setImporting(false);
    }
  }

  const filteredClients = clients?.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())) ?? null;
  const disabled = !activeClientId;

  return (
    <motion.div variants={staggerContainer(0.06)} initial="hidden" animate="show" className="max-w-[1400px] space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Agency &amp; clients</h1>
        <p className="text-sm text-neutral-400">
          {activeClient ? (
            <>
              Working on <span className="font-medium text-accent-300">{activeClient.name}</span> — every panel below
              acts on it.
            </>
          ) : (
            'Create a client or select one from the list to start filling in the panels below.'
          )}
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
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {/* 1. All Clients Page */}
        <Card padding="lg">
          <PanelHeader n={1} title="All Clients Page" icon={LayoutList} color="#0ea5e9" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients…" className="mb-2" />
          <div className="max-h-52 space-y-1.5 overflow-y-auto">
            {filteredClients === null ? (
              <Skeleton className="h-8 w-full" />
            ) : filteredClients.length === 0 ? (
              <p className="py-2 text-xs text-neutral-500">No clients yet.</p>
            ) : (
              filteredClients.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectClient(c)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                    activeClientId === c.id ? 'bg-accent-500/20 text-accent-200' : 'text-neutral-300 hover:bg-white/[0.05]'
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="flex shrink-0 gap-1">
                    <Badge tone="neutral">{c.plan}</Badge>
                    <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABELS[c.status]}</Badge>
                  </span>
                </button>
              ))
            )}
          </div>
          <div className="mt-3 flex items-center gap-3 border-t border-white/10 pt-3">
            <Button type="button" variant="secondary" size="sm" onClick={onExportCsv} disabled={!clients?.length}>
              Export CSV
            </Button>
            <label className="cursor-pointer text-xs font-medium text-accent-300 hover:underline">
              {importing ? 'Importing…' : 'Import CSV'}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={importing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) onImportCsv(file);
                }}
              />
            </label>
          </div>
        </Card>

        {/* 2. Add Client */}
        <Card padding="lg">
          <PanelHeader n={2} title="Add Client" icon={UserPlus} color="#10b981" />
          <form onSubmit={onCreateClient} className="space-y-2">
            <Input
              placeholder="Client name"
              required
              value={newClient.name}
              onChange={(e) => setNewClient((p) => ({ ...p, name: e.target.value }))}
            />
            <Input
              placeholder="Primary contact name"
              value={newClient.contactName}
              onChange={(e) => setNewClient((p) => ({ ...p, contactName: e.target.value }))}
            />
            <Input
              type="email"
              placeholder="Email address"
              value={newClient.contactEmail}
              onChange={(e) => setNewClient((p) => ({ ...p, contactEmail: e.target.value }))}
            />
            <Input
              placeholder="Phone number"
              value={newClient.phone}
              onChange={(e) => setNewClient((p) => ({ ...p, phone: e.target.value }))}
            />
            <Input
              placeholder="Website"
              value={newClient.website}
              onChange={(e) => setNewClient((p) => ({ ...p, website: e.target.value }))}
            />
            <Select value={newClient.plan} onChange={(e) => setNewClient((p) => ({ ...p, plan: e.target.value as ClientPlan }))}>
              {PLANS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <Button type="submit" size="sm" className="w-full" loading={creatingClient}>
              Save &amp; Select
            </Button>
          </form>
        </Card>

        {/* 3. Client Details & Settings */}
        <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
          <PanelHeader n={3} title="Client Details & Settings" icon={ClipboardList} color="#f59e0b" />
          {disabled || !details ? (
            <p className="text-xs text-neutral-500">Select or create a client first.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Business type"
                  value={details.businessType}
                  onChange={(e) => setDetails((p) => (p ? { ...p, businessType: e.target.value } : p))}
                />
                <Input
                  placeholder="Industry"
                  value={details.industry}
                  onChange={(e) => setDetails((p) => (p ? { ...p, industry: e.target.value } : p))}
                />
                <Input
                  placeholder="Time zone"
                  value={details.timeZone}
                  onChange={(e) => setDetails((p) => (p ? { ...p, timeZone: e.target.value } : p))}
                />
                <Input
                  placeholder="Currency"
                  value={details.currency}
                  onChange={(e) => setDetails((p) => (p ? { ...p, currency: e.target.value } : p))}
                />
              </div>
              <Input
                placeholder="Default language"
                value={details.defaultLanguage}
                onChange={(e) => setDetails((p) => (p ? { ...p, defaultLanguage: e.target.value } : p))}
              />
              <Input
                placeholder="Address"
                value={details.address}
                onChange={(e) => setDetails((p) => (p ? { ...p, address: e.target.value } : p))}
              />
              <div className="grid grid-cols-2 gap-2">
                <Select value={details.plan} onChange={(e) => setDetails((p) => (p ? { ...p, plan: e.target.value as ClientPlan } : p))}>
                  {PLANS.map((pl) => (
                    <option key={pl} value={pl}>
                      {pl}
                    </option>
                  ))}
                </Select>
                <Select
                  value={details.status}
                  onChange={(e) => setDetails((p) => (p ? { ...p, status: e.target.value as ClientStatus } : p))}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </div>
              <label className="flex items-center gap-2 text-xs text-neutral-300">
                <input
                  type="checkbox"
                  checked={details.allowClientPortalAccess}
                  onChange={(e) => setDetails((p) => (p ? { ...p, allowClientPortalAccess: e.target.checked } : p))}
                  className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 text-accent-500 focus:ring-accent-400"
                />
                Allow Client Portal Access
              </label>
              <textarea
                placeholder="Notes"
                value={details.notes}
                onChange={(e) => setDetails((p) => (p ? { ...p, notes: e.target.value } : p))}
                rows={2}
                className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
              />
              <Button size="sm" className="w-full" loading={savingDetails} onClick={onSaveDetails}>
                Save Details
              </Button>
            </div>
          )}
        </Card>

        {/* 4. Invite Client Users */}
        <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
          <PanelHeader n={4} title="Invite Client Users" icon={Send} color="#f43f5e" />
          {disabled ? (
            <p className="text-xs text-neutral-500">Select or create a client first.</p>
          ) : (
            <div className="space-y-2">
              <div className="max-h-28 space-y-1.5 overflow-y-auto">
                {access.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-neutral-300">
                      {m.name} <Badge tone="neutral">{ROLE_LABELS[m.role]}</Badge>
                    </span>
                    <button onClick={() => onRevoke(m.id)} className="font-medium text-red-400 hover:underline">
                      Remove
                    </button>
                  </div>
                ))}
                {access.length === 0 && <p className="text-xs text-neutral-500">No users have access yet.</p>}
              </div>
              {credentials.length > 0 && (
                <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-2 text-[11px]">
                  <p className="mb-1 text-emerald-300">
                    No email service — copy these to share manually:
                  </p>
                  {credentials.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => copyToClipboard(`${c.email} / ${c.password}`)}
                      className="flex w-full items-center justify-between font-mono text-neutral-300 hover:text-accent-300"
                    >
                      <span>{c.email}</span>
                      <span className="flex items-center gap-1">
                        {c.password} <Copy className="h-3 w-3" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <Input placeholder="Name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
              <Input
                type="email"
                placeholder="Email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                className="w-full"
                loading={inviting}
                disabled={!inviteEmail.trim() || !inviteName.trim()}
                onClick={onInviteUser}
              >
                Add User
              </Button>
              <div className="flex gap-2 border-t border-white/10 pt-2">
                <div className="flex-1">
                  <Select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                    <option value="">Grant an existing member…</option>
                    {members.filter((m) => !access.some((a) => a.id === m.id)).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button size="sm" variant="secondary" onClick={onGrantExisting}>
                  Grant
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* 5. Connect Social Accounts */}
        <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
          <PanelHeader n={5} title="Connect Social Accounts" icon={Link2} color="#d946ef" />
          {disabled ? (
            <p className="text-xs text-neutral-500">Select or create a client first.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-neutral-300">
                {socialCount === null
                  ? 'Checking…'
                  : socialCount > 0
                    ? `${socialCount} account${socialCount === 1 ? '' : 's'} connected.`
                    : 'No accounts connected yet.'}
              </p>
              <p className="text-xs text-neutral-500">
                Real OAuth connections (Facebook, Instagram, LinkedIn, X, YouTube, WhatsApp) happen
                on the Social Accounts page.
              </p>
              <Link
                href={`/social-accounts?client=${activeClientId}`}
                className="inline-block rounded-xl border border-accent-400/40 bg-accent-500/15 px-3 py-1.5 text-xs font-medium text-accent-200 hover:bg-accent-500/25"
              >
                Open Social Accounts →
              </Link>
            </div>
          )}
        </Card>

        {/* 6. Brand Kit & Preferences */}
        <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
          <PanelHeader n={6} title="Brand Kit & Preferences" icon={Palette} color="#8b5cf6" />
          {disabled ? (
            <p className="text-xs text-neutral-500">Select or create a client first.</p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {brandKit.logoUrl ? (
                  <img
                    src={resolveMediaUrl(brandKit.logoUrl)}
                    alt="Logo"
                    className="h-10 w-10 rounded-lg border border-white/12 object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-white/15 text-[9px] text-neutral-500">
                    No logo
                  </div>
                )}
                <label className="cursor-pointer text-xs font-medium text-accent-300 hover:underline">
                  {uploadingLogo ? 'Uploading…' : 'Upload logo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingLogo}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) onUploadLogo(file);
                    }}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Primary color"
                  value={brandKit.primaryColor ?? ''}
                  onChange={(e) => setBrandKit((p) => ({ ...p, primaryColor: e.target.value }))}
                />
                <Input
                  placeholder="Secondary color"
                  value={brandKit.secondaryColor ?? ''}
                  onChange={(e) => setBrandKit((p) => ({ ...p, secondaryColor: e.target.value }))}
                />
              </div>
              <textarea
                placeholder="Voice guidelines"
                value={brandKit.voiceGuidelines ?? ''}
                onChange={(e) => setBrandKit((p) => ({ ...p, voiceGuidelines: e.target.value }))}
                rows={2}
                className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
              />
              <Button size="sm" className="w-full" loading={savingBrandKit} onClick={onSaveBrandKit}>
                Save Brand Kit
              </Button>
            </div>
          )}
        </Card>

        {/* 7. Client Summary */}
        <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
          <PanelHeader n={7} title="Client Summary" icon={ClipboardCheck} color="#0ea5e9" />
          {disabled || !activeClient ? (
            <p className="text-xs text-neutral-500">Select or create a client first.</p>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-neutral-100">{activeClient.name}</span>
                <Badge tone={STATUS_TONE[activeClient.status]}>{STATUS_LABELS[activeClient.status]}</Badge>
              </div>
              <p className="text-neutral-400">Contact: {activeClient.contactName || '—'}</p>
              <p className="text-neutral-400">Email: {activeClient.contactEmail || '—'}</p>
              <p className="text-neutral-400">Plan: {activeClient.plan}</p>
              <p className="text-neutral-400">Users with access: {access.length}</p>
              <p className="text-neutral-400">Social accounts: {socialCount ?? '—'}</p>
              <p className="text-neutral-400">Brand kit: {brandKit.logoUrl ? 'Logo set' : 'No logo yet'}</p>
            </div>
          )}
        </Card>

        {/* 8. Client Portal Access */}
        <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
          <PanelHeader n={8} title="Client Portal Access" icon={CheckCircle2} color="#22c55e" />
          {disabled || !activeClient ? (
            <p className="text-xs text-neutral-500">Select or create a client first.</p>
          ) : (
            <div className="space-y-3 text-xs">
              <p className="text-neutral-300">
                {activeClient.allowClientPortalAccess
                  ? 'Portal access is allowed for this client.'
                  : 'Portal access is currently blocked for this client (set in Details & Settings).'}
              </p>
              <p className="text-neutral-500">
                Client users log in at the same login page with the credentials shown in Invite
                Client Users — they land in their own scoped Client Portal automatically.
              </p>
              <Link href="/admin/members" className="inline-block font-medium text-accent-300 hover:underline">
                Manage all members →
              </Link>
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
