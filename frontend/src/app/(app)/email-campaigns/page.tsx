'use client';

import { FormEvent, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { useClientPicker } from '@/hooks/use-client-picker';
import { ClientPicker } from '@/components/client-picker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

type CampaignStatus = 'DRAFT' | 'QUEUED' | 'SENDING' | 'SENT';
type RecipientStatus = 'PENDING' | 'SENT' | 'FAILED' | 'UNSUBSCRIBED';

const STATUS_TONE: Record<CampaignStatus, 'neutral' | 'accent' | 'success'> = {
  DRAFT: 'neutral',
  QUEUED: 'accent',
  SENDING: 'accent',
  SENT: 'success',
};

const RECIPIENT_TONE: Record<RecipientStatus, 'neutral' | 'accent' | 'success' | 'danger'> = {
  PENDING: 'neutral',
  SENT: 'success',
  FAILED: 'danger',
  UNSUBSCRIBED: 'neutral',
};

interface CampaignSummary {
  id: string;
  name: string;
  subject: string;
  status: CampaignStatus;
  _count: { recipients: number };
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  status: RecipientStatus;
  errorMessage: string | null;
}

interface CampaignDetail extends Omit<CampaignSummary, '_count'> {
  bodyTemplate: string;
  recipients: Recipient[];
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

export default function EmailCampaignsPage() {
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

  function loadCampaigns() {
    if (!selectedClientId) return;
    api
      .get<CampaignSummary[]>(`/clients/${selectedClientId}/email-campaigns`)
      .then(setCampaigns)
      .catch(() => setCampaigns([]));
  }

  function loadSelected(id: string) {
    api
      .get<CampaignDetail>(`/clients/${selectedClientId}/email-campaigns/${id}`)
      .then(setSelected)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load campaign'));
  }

  useEffect(() => {
    setSelected(null);
    setCampaigns(null);
    loadCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!selectedClientId) return;
    setCreating(true);
    setError(null);
    try {
      const campaign = await api.post<CampaignDetail>(`/clients/${selectedClientId}/email-campaigns`, {
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

      await api.post(`/clients/${selectedClientId}/email-campaigns/${selected.id}/recipients/bulk`, {
        recipients,
      });
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
      await api.delete(`/clients/${selectedClientId}/email-campaigns/${selected.id}/recipients/${recipientId}`);
      loadSelected(selected.id);
      loadCampaigns();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove recipient');
    }
  }

  async function onSend() {
    if (!selected) return;
    setSending(true);
    setError(null);
    try {
      await api.post(`/clients/${selectedClientId}/email-campaigns/${selected.id}/send`);
      loadSelected(selected.id);
      loadCampaigns();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send campaign');
    } finally {
      setSending(false);
    }
  }

  const isDraft = selected?.status === 'DRAFT';

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
                      onClick={() => loadSelected(c.id)}
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
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-50">{selected.name}</h2>
                  <p className="text-sm text-neutral-400">{selected.subject}</p>
                </div>
                <Badge tone={STATUS_TONE[selected.status]}>{selected.status}</Badge>
              </div>

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

              {isDraft && (
                <Button
                  onClick={onSend}
                  loading={sending}
                  disabled={selected.recipients.filter((r) => r.status === 'PENDING').length === 0}
                  className="w-full"
                >
                  Send to {selected.recipients.filter((r) => r.status === 'PENDING').length} recipient(s)
                </Button>
              )}
            </Card>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
