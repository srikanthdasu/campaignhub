'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
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
  Building2,
  LayoutList,
  UserPlus,
  ClipboardList,
  Send,
  Link2,
  Palette,
  CheckCircle2,
  Copy,
  X,
  type LucideIcon,
} from 'lucide-react';

interface WorkflowStep {
  n: number;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  { n: 1, title: 'Add Client', description: 'Create a new client record.', icon: UserPlus, color: '#10b981' },
  { n: 2, title: 'Add Details', description: 'Business type, industry, address, locale.', icon: ClipboardList, color: '#f59e0b' },
  { n: 3, title: 'Invite Client Users', description: 'Create their login, grant portal access.', icon: Send, color: '#f43f5e' },
  { n: 4, title: 'Connect Accounts', description: 'Link real social accounts for this client.', icon: Link2, color: '#d946ef' },
  { n: 5, title: 'Set Brand Kit', description: 'Logo, colors, voice guidelines.', icon: Palette, color: '#8b5cf6' },
  { n: 6, title: 'Client Summary', description: 'Review everything before finishing.', icon: LayoutList, color: '#0ea5e9' },
  { n: 7, title: 'Client Portal Access', description: 'Client can log in to their own portal.', icon: CheckCircle2, color: '#22c55e' },
  { n: 8, title: 'Ready to Use', description: 'Start creating content for this client.', icon: Building2, color: '#6366f1' },
];

function ClientWorkflowGuide() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {WORKFLOW_STEPS.map((step) => {
        const Icon = step.icon;
        return (
          <div
            key={step.n}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5"
            style={{ borderTopColor: step.color, borderTopWidth: 2 }}
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ backgroundColor: step.color }}
              >
                {step.n}
              </span>
              <Icon className="h-4 w-4 shrink-0" style={{ color: step.color }} strokeWidth={2} />
              <p className="truncate text-xs font-semibold text-neutral-100">{step.title}</p>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-neutral-400">{step.description}</p>
          </div>
        );
      })}
    </div>
  );
}

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

interface ClientDetailsForm {
  contactName: string;
  contactEmail: string;
  phone: string;
  website: string;
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

function toDetailsForm(client: Client): ClientDetailsForm {
  return {
    contactName: client.contactName ?? '',
    contactEmail: client.contactEmail ?? '',
    phone: client.phone ?? '',
    website: client.website ?? '',
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

const EMPTY_NEW_CLIENT = {
  name: '',
  contactName: '',
  contactEmail: '',
  phone: '',
  website: '',
  plan: 'BASIC' as ClientPlan,
};

const EMPTY_NEW_DETAILS = {
  businessType: '',
  industry: '',
  address: '',
  timeZone: '',
  currency: '',
  defaultLanguage: '',
  allowClientPortalAccess: true,
  notes: '',
};

interface InvitedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  password: string;
}

export default function AgencyAdminPage() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [access, setAccess] = useState<Member[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [accessLoading, setAccessLoading] = useState(false);
  const [brandKit, setBrandKit] = useState<BrandKit>({
    logoUrl: null,
    primaryColor: '',
    secondaryColor: '',
    voiceGuidelines: '',
    aiContext: '',
  });
  const [savingBrandKit, setSavingBrandKit] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [details, setDetails] = useState<ClientDetailsForm | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [importing, setImporting] = useState(false);

  // Add-client wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardBusy, setWizardBusy] = useState(false);
  const [wizardClient, setWizardClient] = useState<Client | null>(null);
  const [newClient, setNewClient] = useState(EMPTY_NEW_CLIENT);
  const [newDetails, setNewDetails] = useState(EMPTY_NEW_DETAILS);
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('CLIENT');
  const [wizardBrandKit, setWizardBrandKit] = useState<BrandKit>({
    logoUrl: null,
    primaryColor: '',
    secondaryColor: '',
    voiceGuidelines: '',
    aiContext: '',
  });
  const [socialCount, setSocialCount] = useState<number | null>(null);

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

  const CSV_COLUMNS = [
    'name',
    'contactName',
    'contactEmail',
    'phone',
    'website',
    'businessType',
    'industry',
    'plan',
  ] as const;

  function csvEscape(value: string): string {
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }

  function onExportCsv() {
    if (!clients?.length) return;
    const rows = [
      CSV_COLUMNS.join(','),
      ...clients.map((c) =>
        CSV_COLUMNS.map((col) => csvEscape(String(c[col as keyof Client] ?? ''))).join(','),
      ),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clients.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Minimal CSV row parser — handles quoted fields containing commas, not full RFC 4180 (no
  // embedded newlines inside a quoted field), which is enough for the flat contact/business
  // fields this import supports.
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

  // --- Add-client wizard -----------------------------------------------------------------

  function openWizard() {
    setWizardOpen(true);
    setWizardStep(1);
    setWizardClient(null);
    setNewClient(EMPTY_NEW_CLIENT);
    setNewDetails(EMPTY_NEW_DETAILS);
    setInvitedUsers([]);
    setWizardBrandKit({ logoUrl: null, primaryColor: '', secondaryColor: '', voiceGuidelines: '', aiContext: '' });
    setSocialCount(null);
    setError(null);
  }

  function closeWizard() {
    setWizardOpen(false);
    loadClients();
  }

  async function onWizardCreateClient(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setWizardBusy(true);
    try {
      const client = await api.post<Client>('/clients', newClient);
      setWizardClient(client);
      setWizardStep(2);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create client');
    } finally {
      setWizardBusy(false);
    }
  }

  async function onWizardSaveDetails() {
    if (!wizardClient) return;
    setError(null);
    setWizardBusy(true);
    try {
      const updated = await api.patch<Client>(`/clients/${wizardClient.id}`, newDetails);
      setWizardClient(updated);
      setWizardStep(3);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save client details');
    } finally {
      setWizardBusy(false);
    }
  }

  async function onWizardInviteUser() {
    if (!wizardClient || !inviteEmail.trim() || !inviteName.trim()) return;
    setError(null);
    setWizardBusy(true);
    try {
      const password = generatePassword();
      const created = await api.post<{ id: string }>('/users', {
        email: inviteEmail.trim(),
        name: inviteName.trim(),
        password,
        role: inviteRole,
        clientIds: [wizardClient.id],
      });
      setInvitedUsers((prev) => [
        ...prev,
        { id: created.id, name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole, password },
      ]);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('CLIENT');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create user');
    } finally {
      setWizardBusy(false);
    }
  }

  async function onWizardEnterConnectStep() {
    if (!wizardClient) return;
    setWizardStep(4);
    try {
      const accounts = await api.get<unknown[]>(`/clients/${wizardClient.id}/social-accounts`);
      setSocialCount(accounts.length);
    } catch {
      setSocialCount(0);
    }
  }

  async function onWizardUploadLogo(file: File) {
    if (!wizardClient) return;
    setUploadingLogo(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('folder', 'logos');
      const asset = await api.upload<{ storageUrl: string }>(`/clients/${wizardClient.id}/media`, form);
      const updatedKit = await api.put<BrandKit>(`/clients/${wizardClient.id}/brand-kit`, {
        ...wizardBrandKit,
        logoUrl: asset.storageUrl,
      });
      setWizardBrandKit(updatedKit);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function onWizardSaveBrandKit() {
    if (!wizardClient) return;
    setSavingBrandKit(true);
    setError(null);
    try {
      await api.put(`/clients/${wizardClient.id}/brand-kit`, wizardBrandKit);
      setWizardStep(6);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save brand kit');
    } finally {
      setSavingBrandKit(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  // --- Existing client management (unchanged from here down, plus new fields) -----------

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
      const kit = await api.get<BrandKit | null>(`/clients/${clientId}/brand-kit`);
      setBrandKit({
        logoUrl: kit?.logoUrl ?? null,
        primaryColor: kit?.primaryColor ?? '',
        secondaryColor: kit?.secondaryColor ?? '',
        voiceGuidelines: kit?.voiceGuidelines ?? '',
        aiContext: kit?.aiContext ?? '',
      });
      const client = clients?.find((c) => c.id === clientId);
      if (client) setDetails(toDetailsForm(client));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load client access');
    } finally {
      setAccessLoading(false);
    }
  }

  async function onSaveDetails(clientId: string) {
    if (!details) return;
    setSavingDetails(true);
    setError(null);
    try {
      const updated = await api.patch<Client>(`/clients/${clientId}`, details);
      setClients((prev) => prev?.map((c) => (c.id === clientId ? updated : c)) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save client details');
    } finally {
      setSavingDetails(false);
    }
  }

  async function onUploadLogo(clientId: string, file: File) {
    setUploadingLogo(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('folder', 'logos');
      const asset = await api.upload<{ storageUrl: string }>(`/clients/${clientId}/media`, form);
      const updatedKit = await api.put<BrandKit>(`/clients/${clientId}/brand-kit`, {
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

  async function onSaveBrandKit(clientId: string) {
    setSavingBrandKit(true);
    setError(null);
    try {
      await api.put(`/clients/${clientId}/brand-kit`, brandKit);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save brand kit');
    } finally {
      setSavingBrandKit(false);
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

  const filteredClients = clients?.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())) ?? null;

  return (
    <motion.div
      variants={staggerContainer(0.08)}
      initial="hidden"
      animate="show"
      className="max-w-4xl space-y-8"
    >
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Agency &amp; clients</h1>
        <p className="text-sm text-neutral-400">
          Create clients and control which members can access each one.
        </p>
      </motion.div>

      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <ClientWorkflowGuide />
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

      {/* All Clients page */}
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <Card padding="lg">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clients…"
              />
            </div>
            <Button onClick={openWizard}>+ Add Client</Button>
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
            <span className="text-xs text-neutral-500">
              Columns: name, contactName, contactEmail, phone, website, businessType, industry, plan
            </span>
          </div>
        </Card>
      </motion.div>

      {/* Add-client wizard */}
      <AnimatePresence>
        {wizardOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: DURATION.base, ease: EASE_SOFT }}
            className="overflow-hidden"
          >
            <Card padding="lg">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-50">
                  Add client — step {wizardStep} of 6
                </h2>
                <button onClick={closeWizard} className="text-neutral-500 hover:text-neutral-300">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {wizardStep === 1 && (
                <form onSubmit={onWizardCreateClient} className="space-y-3">
                  <Input
                    label="Client name"
                    required
                    value={newClient.name}
                    onChange={(e) => setNewClient((p) => ({ ...p, name: e.target.value }))}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Primary contact name"
                      value={newClient.contactName}
                      onChange={(e) => setNewClient((p) => ({ ...p, contactName: e.target.value }))}
                    />
                    <Input
                      label="Email address"
                      type="email"
                      value={newClient.contactEmail}
                      onChange={(e) => setNewClient((p) => ({ ...p, contactEmail: e.target.value }))}
                    />
                    <Input
                      label="Phone number"
                      value={newClient.phone}
                      onChange={(e) => setNewClient((p) => ({ ...p, phone: e.target.value }))}
                    />
                    <Input
                      label="Website"
                      value={newClient.website}
                      onChange={(e) => setNewClient((p) => ({ ...p, website: e.target.value }))}
                    />
                  </div>
                  <Select
                    label="Plan"
                    value={newClient.plan}
                    onChange={(e) => setNewClient((p) => ({ ...p, plan: e.target.value as ClientPlan }))}
                  >
                    {PLANS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="secondary" onClick={closeWizard}>
                      Cancel
                    </Button>
                    <Button type="submit" loading={wizardBusy}>
                      Save &amp; Next
                    </Button>
                  </div>
                </form>
              )}

              {wizardStep === 2 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Business type"
                      value={newDetails.businessType}
                      onChange={(e) => setNewDetails((p) => ({ ...p, businessType: e.target.value }))}
                    />
                    <Input
                      label="Industry"
                      value={newDetails.industry}
                      onChange={(e) => setNewDetails((p) => ({ ...p, industry: e.target.value }))}
                    />
                    <Input
                      label="Time zone"
                      placeholder="Asia/Kolkata"
                      value={newDetails.timeZone}
                      onChange={(e) => setNewDetails((p) => ({ ...p, timeZone: e.target.value }))}
                    />
                    <Input
                      label="Currency"
                      placeholder="INR"
                      value={newDetails.currency}
                      onChange={(e) => setNewDetails((p) => ({ ...p, currency: e.target.value }))}
                    />
                    <Input
                      label="Default language"
                      placeholder="English"
                      value={newDetails.defaultLanguage}
                      onChange={(e) => setNewDetails((p) => ({ ...p, defaultLanguage: e.target.value }))}
                    />
                  </div>
                  <Input
                    label="Address"
                    value={newDetails.address}
                    onChange={(e) => setNewDetails((p) => ({ ...p, address: e.target.value }))}
                  />
                  <textarea
                    placeholder="Notes"
                    value={newDetails.notes}
                    onChange={(e) => setNewDetails((p) => ({ ...p, notes: e.target.value }))}
                    rows={2}
                    className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
                  />
                  <label className="flex items-center gap-2.5 text-sm text-neutral-300">
                    <input
                      type="checkbox"
                      checked={newDetails.allowClientPortalAccess}
                      onChange={(e) => setNewDetails((p) => ({ ...p, allowClientPortalAccess: e.target.checked }))}
                      className="h-4 w-4 rounded border-white/20 bg-white/5 text-accent-500 focus:ring-accent-400"
                    />
                    Allow Client Portal Access
                  </label>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" onClick={() => setWizardStep(1)}>
                      Back
                    </Button>
                    <Button loading={wizardBusy} onClick={onWizardSaveDetails}>
                      Save &amp; Next
                    </Button>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-3">
                  <p className="text-xs text-neutral-400">
                    No email service is set up, so nothing gets sent automatically — each user's
                    login and temporary password appear below for you to share directly.
                  </p>
                  {invitedUsers.length > 0 && (
                    <ul className="space-y-2">
                      {invitedUsers.map((u) => (
                        <li
                          key={u.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2 text-xs"
                        >
                          <span className="text-neutral-300">
                            {u.name} <span className="text-neutral-500">({u.email})</span>{' '}
                            <Badge tone="neutral">{ROLE_LABELS[u.role]}</Badge>
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(`${u.email} / ${u.password}`)}
                            className="flex items-center gap-1 font-mono text-accent-300 hover:underline"
                            title="Copy email and password"
                          >
                            {u.password} <Copy className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="grid grid-cols-[1fr_1fr_auto_auto] items-end gap-2">
                    <Input
                      label="Name"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                    />
                    <Input
                      label="Email address"
                      type="email"
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
                      type="button"
                      loading={wizardBusy}
                      disabled={!inviteEmail.trim() || !inviteName.trim()}
                      onClick={onWizardInviteUser}
                    >
                      Add
                    </Button>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" onClick={() => setWizardStep(2)}>
                      Back
                    </Button>
                    <Button onClick={onWizardEnterConnectStep}>Next</Button>
                  </div>
                </div>
              )}

              {wizardStep === 4 && wizardClient && (
                <div className="space-y-3">
                  <p className="text-sm text-neutral-300">
                    {socialCount === null
                      ? 'Checking connected accounts…'
                      : socialCount > 0
                        ? `${socialCount} social account${socialCount === 1 ? '' : 's'} already connected for this client.`
                        : 'No social accounts connected yet for this client.'}
                  </p>
                  <p className="text-xs text-neutral-500">
                    Connecting real accounts (Facebook, Instagram, LinkedIn, X, YouTube, WhatsApp)
                    happens on the Social Accounts page, with this client pre-selected.
                  </p>
                  <Link
                    href={`/social-accounts?client=${wizardClient.id}`}
                    className="inline-block rounded-xl border border-accent-400/40 bg-accent-500/15 px-3.5 py-2 text-sm font-medium text-accent-200 hover:bg-accent-500/25"
                  >
                    Open Social Accounts →
                  </Link>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" onClick={() => setWizardStep(3)}>
                      Back
                    </Button>
                    <Button onClick={() => setWizardStep(5)}>Next</Button>
                  </div>
                </div>
              )}

              {wizardStep === 5 && wizardClient && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {wizardBrandKit.logoUrl ? (
                      <img
                        src={resolveMediaUrl(wizardBrandKit.logoUrl)}
                        alt="Client logo"
                        className="h-12 w-12 rounded-lg border border-white/12 object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-white/15 text-[10px] text-neutral-500">
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
                          if (file) onWizardUploadLogo(file);
                        }}
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Primary color (#1D4ED8)"
                      value={wizardBrandKit.primaryColor ?? ''}
                      onChange={(e) => setWizardBrandKit((p) => ({ ...p, primaryColor: e.target.value }))}
                    />
                    <Input
                      placeholder="Secondary color"
                      value={wizardBrandKit.secondaryColor ?? ''}
                      onChange={(e) => setWizardBrandKit((p) => ({ ...p, secondaryColor: e.target.value }))}
                    />
                  </div>
                  <textarea
                    placeholder="Voice guidelines"
                    value={wizardBrandKit.voiceGuidelines ?? ''}
                    onChange={(e) => setWizardBrandKit((p) => ({ ...p, voiceGuidelines: e.target.value }))}
                    rows={2}
                    className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
                  />
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" onClick={() => setWizardStep(4)}>
                      Back
                    </Button>
                    <Button loading={savingBrandKit} onClick={onWizardSaveBrandKit}>
                      Save Brand Kit
                    </Button>
                  </div>
                </div>
              )}

              {wizardStep === 6 && wizardClient && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-neutral-50">{wizardClient.name}</h3>
                    <Badge tone={STATUS_TONE[wizardClient.status]}>{STATUS_LABELS[wizardClient.status]}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-neutral-500">Primary contact</p>
                      <p className="text-neutral-200">{newClient.contactName || '—'}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Email</p>
                      <p className="text-neutral-200">{newClient.contactEmail || '—'}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Plan</p>
                      <p className="text-neutral-200">{newClient.plan}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Users invited</p>
                      <p className="text-neutral-200">{invitedUsers.length}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Brand kit</p>
                      <p className="text-neutral-200">{wizardBrandKit.logoUrl ? 'Logo set' : 'No logo yet'}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Client portal access</p>
                      <p className="text-neutral-200">{newDetails.allowClientPortalAccess ? 'Allowed' : 'Blocked'}</p>
                    </div>
                  </div>
                  {invitedUsers.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-neutral-300">
                        Login credentials — copy these before finishing, they won&apos;t be shown again
                      </p>
                      <ul className="space-y-1.5">
                        {invitedUsers.map((u) => (
                          <li key={u.id} className="flex items-center justify-between text-xs">
                            <span className="text-neutral-400">{u.email}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(`${u.email} / ${u.password}`)}
                              className="flex items-center gap-1 font-mono text-accent-300 hover:underline"
                            >
                              {u.password} <Copy className="h-3 w-3" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-300">
                    Client is ready — invited users can log in at /login now, and you can create
                    content for {wizardClient.name} right away.
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" onClick={() => setWizardStep(5)}>
                      Back
                    </Button>
                    <Button onClick={closeWizard}>Finish</Button>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        {filteredClients === null ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : filteredClients.length === 0 ? (
          <Card padding="lg">
            <p className="text-sm text-neutral-400">
              {clients?.length ? 'No clients match your search.' : 'No clients yet.'}
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {filteredClients.map((client) => (
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
                      className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-neutral-50"
                    >
                      <span className="flex items-center gap-2">
                        {client.name}
                        <Badge tone="neutral">{client.plan}</Badge>
                        <Badge tone={STATUS_TONE[client.status]}>{STATUS_LABELS[client.status]}</Badge>
                        {!client.allowClientPortalAccess && <Badge tone="danger">Portal blocked</Badge>}
                      </span>
                      <span className="text-xs font-normal text-accent-300">
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
                          className="overflow-hidden border-t border-white/10"
                        >
                          <div className="space-y-3 px-5 py-4">
                            <div className="flex items-center gap-3 text-xs">
                              <Link
                                href={`/social-accounts?client=${client.id}`}
                                className="font-medium text-accent-300 hover:underline"
                              >
                                Social Accounts →
                              </Link>
                              <Link href="/admin/members" className="font-medium text-accent-300 hover:underline">
                                Members →
                              </Link>
                            </div>

                            {accessLoading ? (
                              <Skeleton className="h-6 w-40" />
                            ) : (
                              <ul className="space-y-2">
                                {access.length === 0 && (
                                  <li className="text-xs text-neutral-400">
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
                                      <span className="flex items-center gap-2 text-neutral-300">
                                        {m.name} <Badge tone="neutral">{ROLE_LABELS[m.role]}</Badge>
                                      </span>
                                      <button
                                        onClick={() => onRevoke(client.id, m.id)}
                                        className="font-medium text-red-400 hover:underline"
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

                            {details && (
                              <div className="border-t border-white/10 pt-4">
                                <p className="mb-3 text-xs font-medium text-neutral-300">Client details</p>
                                <div className="grid grid-cols-2 gap-3">
                                  <Input
                                    placeholder="Contact name"
                                    value={details.contactName}
                                    onChange={(e) =>
                                      setDetails((prev) => (prev ? { ...prev, contactName: e.target.value } : prev))
                                    }
                                  />
                                  <Input
                                    type="email"
                                    placeholder="Contact email"
                                    value={details.contactEmail}
                                    onChange={(e) =>
                                      setDetails((prev) => (prev ? { ...prev, contactEmail: e.target.value } : prev))
                                    }
                                  />
                                  <Input
                                    placeholder="Phone"
                                    value={details.phone}
                                    onChange={(e) =>
                                      setDetails((prev) => (prev ? { ...prev, phone: e.target.value } : prev))
                                    }
                                  />
                                  <Input
                                    placeholder="Website"
                                    value={details.website}
                                    onChange={(e) =>
                                      setDetails((prev) => (prev ? { ...prev, website: e.target.value } : prev))
                                    }
                                  />
                                  <Input
                                    placeholder="Business type"
                                    value={details.businessType}
                                    onChange={(e) =>
                                      setDetails((prev) => (prev ? { ...prev, businessType: e.target.value } : prev))
                                    }
                                  />
                                  <Input
                                    placeholder="Industry"
                                    value={details.industry}
                                    onChange={(e) =>
                                      setDetails((prev) => (prev ? { ...prev, industry: e.target.value } : prev))
                                    }
                                  />
                                  <Input
                                    placeholder="Time zone"
                                    value={details.timeZone}
                                    onChange={(e) =>
                                      setDetails((prev) => (prev ? { ...prev, timeZone: e.target.value } : prev))
                                    }
                                  />
                                  <Input
                                    placeholder="Currency"
                                    value={details.currency}
                                    onChange={(e) =>
                                      setDetails((prev) => (prev ? { ...prev, currency: e.target.value } : prev))
                                    }
                                  />
                                  <Input
                                    placeholder="Default language"
                                    value={details.defaultLanguage}
                                    onChange={(e) =>
                                      setDetails((prev) => (prev ? { ...prev, defaultLanguage: e.target.value } : prev))
                                    }
                                  />
                                  <Input
                                    placeholder="Address"
                                    value={details.address}
                                    onChange={(e) =>
                                      setDetails((prev) => (prev ? { ...prev, address: e.target.value } : prev))
                                    }
                                  />
                                  <Select
                                    value={details.plan}
                                    onChange={(e) =>
                                      setDetails((prev) =>
                                        prev ? { ...prev, plan: e.target.value as ClientPlan } : prev,
                                      )
                                    }
                                  >
                                    {PLANS.map((p) => (
                                      <option key={p} value={p}>
                                        {p}
                                      </option>
                                    ))}
                                  </Select>
                                  <Select
                                    value={details.status}
                                    onChange={(e) =>
                                      setDetails((prev) =>
                                        prev ? { ...prev, status: e.target.value as ClientStatus } : prev,
                                      )
                                    }
                                  >
                                    {STATUSES.map((s) => (
                                      <option key={s} value={s}>
                                        {STATUS_LABELS[s]}
                                      </option>
                                    ))}
                                  </Select>
                                </div>
                                <label className="mt-3 flex items-center gap-2.5 text-sm text-neutral-300">
                                  <input
                                    type="checkbox"
                                    checked={details.allowClientPortalAccess}
                                    onChange={(e) =>
                                      setDetails((prev) =>
                                        prev ? { ...prev, allowClientPortalAccess: e.target.checked } : prev,
                                      )
                                    }
                                    className="h-4 w-4 rounded border-white/20 bg-white/5 text-accent-500 focus:ring-accent-400"
                                  />
                                  Allow Client Portal Access
                                </label>
                                <textarea
                                  placeholder="Notes"
                                  value={details.notes}
                                  onChange={(e) =>
                                    setDetails((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
                                  }
                                  rows={2}
                                  className="mt-3 w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
                                />
                                <Button
                                  size="sm"
                                  className="mt-3"
                                  loading={savingDetails}
                                  onClick={() => onSaveDetails(client.id)}
                                >
                                  Save details
                                </Button>
                              </div>
                            )}

                            <div className="border-t border-white/10 pt-4">
                              <p className="mb-3 text-xs font-medium text-neutral-300">
                                Brand kit
                              </p>
                              <div className="mb-3 flex items-center gap-3">
                                {brandKit.logoUrl ? (
                                  <img
                                    src={resolveMediaUrl(brandKit.logoUrl)}
                                    alt="Client logo"
                                    className="h-12 w-12 rounded-lg border border-white/12 object-cover"
                                  />
                                ) : (
                                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-white/15 text-[10px] text-neutral-500">
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
                                      if (file) onUploadLogo(client.id, file);
                                    }}
                                  />
                                </label>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <Input
                                  placeholder="Primary color (#1D4ED8)"
                                  value={brandKit.primaryColor ?? ''}
                                  onChange={(e) =>
                                    setBrandKit((prev) => ({ ...prev, primaryColor: e.target.value }))
                                  }
                                />
                                <Input
                                  placeholder="Secondary color"
                                  value={brandKit.secondaryColor ?? ''}
                                  onChange={(e) =>
                                    setBrandKit((prev) => ({ ...prev, secondaryColor: e.target.value }))
                                  }
                                />
                              </div>
                              <textarea
                                placeholder="Voice guidelines"
                                value={brandKit.voiceGuidelines ?? ''}
                                onChange={(e) =>
                                  setBrandKit((prev) => ({ ...prev, voiceGuidelines: e.target.value }))
                                }
                                rows={2}
                                className="mt-3 w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
                              />
                              <textarea
                                placeholder="AI context (used to keep AI-generated content on-brand)"
                                value={brandKit.aiContext ?? ''}
                                onChange={(e) =>
                                  setBrandKit((prev) => ({ ...prev, aiContext: e.target.value }))
                                }
                                rows={2}
                                className="mt-3 w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
                              />
                              <Button
                                size="sm"
                                className="mt-3"
                                loading={savingBrandKit}
                                onClick={() => onSaveBrandKit(client.id)}
                              >
                                Save brand kit
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
