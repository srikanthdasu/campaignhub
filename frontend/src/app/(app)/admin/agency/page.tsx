'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api, ApiError, resolveMediaUrl } from '@/lib/api';
import { ROLE_LABELS, Role } from '@/lib/roles';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

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
    notes: client.notes ?? '',
    plan: client.plan,
    status: client.status,
  };
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

  return (
    <motion.div
      variants={staggerContainer(0.08)}
      initial="hidden"
      animate="show"
      className="max-w-2xl space-y-8"
    >
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Agency &amp; clients</h1>
        <p className="text-sm text-neutral-400">
          Create clients and control which members can access each one.
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
            <p className="text-sm text-neutral-400">No clients yet.</p>
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
                      className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-neutral-50"
                    >
                      <span className="flex items-center gap-2">
                        {client.name}
                        <Badge tone="neutral">{client.plan}</Badge>
                        <Badge tone={STATUS_TONE[client.status]}>{STATUS_LABELS[client.status]}</Badge>
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
