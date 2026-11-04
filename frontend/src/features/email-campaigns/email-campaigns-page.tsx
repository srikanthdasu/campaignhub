'use client';

import { RequireRole } from '@/components/require-role';

import { FormEvent, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { canSendEmailCampaigns, Role } from '@/lib/roles';
import { useClientPicker } from '@/hooks/use-client-picker';
import { ClientPicker } from '@/components/client-picker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import { STATUS_TONE, RECIPIENT_TONE, SENDER_STATUS_TONE } from './types';
import type { CampaignSummary, CampaignDetail, SenderConfig, SenderDnsRecord } from './types';
import {
  fetchCampaigns,
  fetchCampaignDetail,
  createCampaign,
  importRecipientsBulk,
  removeRecipient,
  updateCampaignDetails,
  sendCampaign,
  requestSendCampaign,
  approveSendCampaign,
  rejectSendCampaign,
  fetchSenderConfig,
  upsertSenderConfig,
  checkSenderVerification,
} from './api/email-campaigns-api';
import { parseCsvLine } from './utils';

export function EmailCampaignsPage() {
  return (
    <RequireRole roles={['OWNER', 'ADMIN', 'MANAGER', 'CLIENT', 'SUPER_ADMIN']}>
      <EmailCampaignsPageContent />
    </RequireRole>
  );
}

function EmailCampaignsPageContent() {
  const { user } = useAuth();
  const canSend = canSendEmailCampaigns(user?.role as Role | undefined);
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [selected, setSelected] = useState<CampaignDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [creating, setCreating] = useState(false);

  const [importing, setImporting] = useState(false);
  const [sending, setSending] = useState(false);
  const [requestingSend, setRequestingSend] = useState(false);
  const [approvingSend, setApprovingSend] = useState(false);
  const [rejectingSend, setRejectingSend] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [editingDetails, setEditingDetails] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  const [sender, setSender] = useState<SenderConfig | null>(null);
  const [senderLoaded, setSenderLoaded] = useState(false);
  const [dnsRecords, setDnsRecords] = useState<SenderDnsRecord[] | null>(null);
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [dailySendLimit, setDailySendLimit] = useState('');
  const [monthlySendLimit, setMonthlySendLimit] = useState('');
  const [savingSender, setSavingSender] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [senderMessage, setSenderMessage] = useState<string | null>(null);
  const [senderError, setSenderError] = useState<string | null>(null);

  function loadCampaigns() {
    if (!selectedClientId) return;
    fetchCampaigns(selectedClientId)
      .then(setCampaigns)
      .catch(() => setCampaigns([]));
  }

  function loadSelected(id: string) {
    fetchCampaignDetail(selectedClientId, id)
      .then(setSelected)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load campaign'));
  }

  function loadSender() {
    if (!selectedClientId || !canSend) return;
    setSenderLoaded(false);
    fetchSenderConfig(selectedClientId)
      .then((config) => {
        setSender(config);
        setSenderName(config?.senderName ?? '');
        setSenderEmail(config?.senderEmail ?? '');
        setDailySendLimit(config?.dailySendLimit != null ? String(config.dailySendLimit) : '');
        setMonthlySendLimit(config?.monthlySendLimit != null ? String(config.monthlySendLimit) : '');
      })
      .catch(() => setSender(null))
      .finally(() => setSenderLoaded(true));
  }

  useEffect(() => {
    setSelected(null);
    setCampaigns(null);
    setEditingDetails(false);
    setDnsRecords(null);
    setSenderMessage(null);
    setSenderError(null);
    loadCampaigns();
    loadSender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!selectedClientId) return;
    setCreating(true);
    setError(null);
    try {
      const campaign = await createCampaign(selectedClientId, {
        name,
        subject,
        bodyTemplate,
      });
      setName('');
      setSubject('');
      setBodyTemplate('');
      loadCampaigns();
      setSelected({ ...campaign, recipients: [] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create campaign');
    } finally {
      setCreating(false);
    }
  }

  async function onImportCsv(file: File) {
    if (!selected) return;
    setImporting(true);
    setError(null);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) throw new Error('CSV has no data rows');
      const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
      const nameIdx = header.indexOf('name');
      const emailIdx = header.indexOf('email');
      if (emailIdx === -1) throw new Error('CSV must have an "email" column');

      const recipients = lines
        .slice(1)
        .map((line) => parseCsvLine(line))
        .map((cells) => ({ name: (nameIdx >= 0 ? cells[nameIdx] : '') || 'there', email: cells[emailIdx] }))
        .filter((r) => r.email);

      if (recipients.length === 0) throw new Error('No valid rows with an email address found');

      await importRecipientsBulk(selectedClientId, selected.id, { recipients });
      loadSelected(selected.id);
      loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import CSV');
    } finally {
      setImporting(false);
    }
  }

  async function onRemoveRecipient(recipientId: string) {
    if (!selected) return;
    try {
      await removeRecipient(selectedClientId, selected.id, recipientId);
      loadSelected(selected.id);
      loadCampaigns();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove recipient');
    }
  }

  function startEditDetails() {
    if (!selected) return;
    setEditName(selected.name);
    setEditSubject(selected.subject);
    setEditBody(selected.bodyTemplate);
    setEditingDetails(true);
  }

  async function onSaveDetails(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSavingDetails(true);
    setError(null);
    try {
      await updateCampaignDetails(selectedClientId, selected.id, {
        name: editName,
        subject: editSubject,
        bodyTemplate: editBody,
      });
      setEditingDetails(false);
      loadSelected(selected.id);
      loadCampaigns();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save changes');
    } finally {
      setSavingDetails(false);
    }
  }

  async function onSend() {
    if (!selected) return;
    setSending(true);
    setError(null);
    try {
      await sendCampaign(selectedClientId, selected.id);
      loadSelected(selected.id);
      loadCampaigns();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send campaign');
    } finally {
      setSending(false);
    }
  }

  async function onRequestSend() {
    if (!selected) return;
    setRequestingSend(true);
    setError(null);
    try {
      await requestSendCampaign(selectedClientId, selected.id);
      loadSelected(selected.id);
      loadCampaigns();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to request send');
    } finally {
      setRequestingSend(false);
    }
  }

  async function onApproveSend() {
    if (!selected) return;
    setApprovingSend(true);
    setError(null);
    try {
      await approveSendCampaign(selectedClientId, selected.id);
      loadSelected(selected.id);
      loadCampaigns();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to approve send');
    } finally {
      setApprovingSend(false);
    }
  }

  async function onRejectSend(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setRejectingSend(true);
    setError(null);
    try {
      await rejectSendCampaign(selectedClientId, selected.id, rejectReason);
      setShowRejectForm(false);
      setRejectReason('');
      loadSelected(selected.id);
      loadCampaigns();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reject send');
    } finally {
      setRejectingSend(false);
    }
  }

  async function onSaveSender(e: FormEvent) {
    e.preventDefault();
    if (!selectedClientId) return;
    setSavingSender(true);
    setSenderError(null);
    setSenderMessage(null);
    try {
      const result = await upsertSenderConfig(selectedClientId, {
        senderName,
        senderEmail,
        ...(dailySendLimit ? { dailySendLimit: Number(dailySendLimit) } : {}),
        ...(monthlySendLimit ? { monthlySendLimit: Number(monthlySendLimit) } : {}),
      });
      setSender(result.sender);
      setDnsRecords(result.dnsRecords);
      setSenderMessage(
        result.dnsRecords
          ? 'Saved. Add the DNS records below, then check verification once they have propagated.'
          : 'Saved.',
      );
    } catch (err) {
      setSenderError(err instanceof ApiError ? err.message : 'Failed to save sender settings');
    } finally {
      setSavingSender(false);
    }
  }

  async function onCheckVerification() {
    if (!selectedClientId) return;
    setCheckingVerification(true);
    setSenderError(null);
    setSenderMessage(null);
    try {
      const result = await checkSenderVerification(selectedClientId);
      setSender(result.sender);
      setSenderMessage(result.message);
    } catch (err) {
      setSenderError(err instanceof ApiError ? err.message : 'Failed to check verification');
    } finally {
      setCheckingVerification(false);
    }
  }

  const isDraft = selected?.status === 'DRAFT';
  const isPendingApproval = selected?.status === 'PENDING_APPROVAL';

  return (
    <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show" className="max-w-4xl space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Email Campaigns</h1>
        <p className="text-sm text-neutral-400">
          Send a personalized email to a list of recipients — insert{' '}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">{'{{name}}'}</code> anywhere in the body to
          merge each recipient&apos;s name in.
        </p>
      </motion.div>

      {clients && clients.length > 0 && (
        <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
          <ClientPicker clients={clients} value={selectedClientId} onChange={setSelectedClientId} />
        </motion.div>
      )}

      {error && (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }} className="space-y-4">
          {canSend && selectedClientId && (
            <Card padding="md">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-50">Sender settings</h2>
                {sender && <Badge tone={SENDER_STATUS_TONE[sender.verificationStatus]}>{sender.verificationStatus}</Badge>}
              </div>

              {!senderLoaded ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-neutral-400">
                    {sender
                      ? 'Campaigns for this client send from this identity once verified.'
                      : 'No sender configured yet — campaigns send from the platform default.'}
                  </p>
                  <form onSubmit={onSaveSender} className="space-y-3">
                    <Input
                      label="From name"
                      required
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                    />
                    <Input
                      label="From email"
                      type="email"
                      required
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        label="Daily limit"
                        type="number"
                        min={1}
                        placeholder="None"
                        value={dailySendLimit}
                        onChange={(e) => setDailySendLimit(e.target.value)}
                      />
                      <Input
                        label="Monthly limit"
                        type="number"
                        min={1}
                        placeholder="None"
                        value={monthlySendLimit}
                        onChange={(e) => setMonthlySendLimit(e.target.value)}
                      />
                    </div>
                    <Button type="submit" size="sm" loading={savingSender} className="w-full">
                      Save sender
                    </Button>
                  </form>

                  {senderError && (
                    <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                      {senderError}
                    </p>
                  )}
                  {senderMessage && !senderError && (
                    <p className="rounded-lg border border-accent-400/30 bg-accent-500/10 px-3 py-2 text-xs text-accent-200">
                      {senderMessage}
                    </p>
                  )}

                  {(dnsRecords || sender?.verificationStatus === 'PENDING') && (
                    <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                      <p className="text-xs font-medium text-neutral-300">DNS records to add at your domain host</p>
                      {dnsRecords ? (
                        <ul className="space-y-1.5">
                          {dnsRecords.map((r, i) => (
                            <li key={i} className="text-xs text-neutral-400">
                              <span className="font-mono text-neutral-300">{r.type}</span> —{' '}
                              <span className="break-all font-mono">{r.hostName}</span>:{' '}
                              <span className="break-all font-mono">{r.value}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-neutral-500">
                          Save the sender again to retrieve the DNS records from the provider.
                        </p>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        loading={checkingVerification}
                        onClick={onCheckVerification}
                        className="w-full"
                      >
                        Check verification
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          <Card padding="md">
            <h2 className="mb-3 text-sm font-semibold text-neutral-50">New campaign</h2>
            <form onSubmit={onCreate} className="space-y-3">
              <Input label="Internal name" required value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="Subject" required value={subject} onChange={(e) => setSubject(e.target.value)} />
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-300">Body</label>
                <textarea
                  required
                  value={bodyTemplate}
                  onChange={(e) => setBodyTemplate(e.target.value)}
                  rows={5}
                  placeholder={'Hi {{name}}, ...'}
                  className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
                />
              </div>
              <Button type="submit" loading={creating} disabled={!selectedClientId} className="w-full" size="sm">
                Create draft
              </Button>
            </form>
          </Card>

          <Card padding="md">
            <h2 className="mb-3 text-sm font-semibold text-neutral-50">Campaigns</h2>
            {campaigns === null ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : campaigns.length === 0 ? (
              <p className="text-sm text-neutral-400">No campaigns yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {campaigns.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => {
                        setEditingDetails(false);
                        loadSelected(c.id);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-neutral-300 hover:bg-white/[0.05]"
                    >
                      <span className="truncate">{c.name}</span>
                      <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
          {!selected ? (
            <Card padding="lg">
              <p className="text-sm text-neutral-400">Select or create a campaign to manage its recipients.</p>
            </Card>
          ) : (
            <Card padding="lg" className="space-y-5">
              {editingDetails ? (
                <form onSubmit={onSaveDetails} className="space-y-3">
                  <Input label="Internal name" required value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <Input label="Subject" required value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-300">Body</label>
                    <textarea
                      required
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={5}
                      className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" loading={savingDetails}>
                      Save Changes
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => setEditingDetails(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-50">{selected.name}</h2>
                    <p className="text-sm text-neutral-400">{selected.subject}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDraft && (
                      <Button size="sm" variant="secondary" onClick={startEditDetails}>
                        Edit
                      </Button>
                    )}
                    <Badge tone={STATUS_TONE[selected.status]}>{selected.status}</Badge>
                  </div>
                </div>
              )}

              {isDraft && selected.rejectionReason && (
                <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-200">
                  Your last send request was rejected: {selected.rejectionReason}
                </p>
              )}

              {isPendingApproval && (
                <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-200">
                  {canSend
                    ? 'This campaign is waiting for your approval before it sends.'
                    : 'Your send request is waiting for an admin to approve it.'}
                </p>
              )}

              {isDraft && (
                <div className="border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-50">Recipients</h3>
                    <label className="cursor-pointer text-xs font-medium text-accent-300 hover:underline">
                      {importing ? 'Importing…' : 'Import CSV (name, email columns)'}
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
                </div>
              )}

              {selected.recipients.length === 0 ? (
                <p className="text-sm text-neutral-400">No recipients yet.</p>
              ) : (
                <ul className="max-h-96 space-y-1.5 overflow-y-auto">
                  {selected.recipients.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-neutral-200">
                          {r.name} <span className="text-neutral-500">&lt;{r.email}&gt;</span>
                        </p>
                        {r.errorMessage && <p className="text-xs text-red-300">{r.errorMessage}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tone={RECIPIENT_TONE[r.status]}>{r.status}</Badge>
                        {isDraft && (
                          <button
                            onClick={() => onRemoveRecipient(r.id)}
                            className="text-xs text-neutral-500 hover:text-red-300"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {isDraft && canSend && (
                <Button
                  onClick={onSend}
                  loading={sending}
                  disabled={selected.recipients.filter((r) => r.status === 'PENDING').length === 0}
                  className="w-full"
                >
                  Send to {selected.recipients.filter((r) => r.status === 'PENDING').length} recipient(s)
                </Button>
              )}

              {isDraft && !canSend && (
                <Button
                  onClick={onRequestSend}
                  loading={requestingSend}
                  disabled={selected.recipients.filter((r) => r.status === 'PENDING').length === 0}
                  className="w-full"
                >
                  Request send to {selected.recipients.filter((r) => r.status === 'PENDING').length} recipient(s)
                </Button>
              )}

              {isPendingApproval && canSend && !showRejectForm && (
                <div className="flex gap-2">
                  <Button onClick={onApproveSend} loading={approvingSend} className="flex-1">
                    Approve &amp; send
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setShowRejectForm(true)}>
                    Reject
                  </Button>
                </div>
              )}

              {isPendingApproval && canSend && showRejectForm && (
                <form onSubmit={onRejectSend} className="space-y-2">
                  <Input
                    label="Reason for rejecting"
                    required
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" variant="danger" loading={rejectingSend} className="flex-1">
                      Confirm reject
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setShowRejectForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
