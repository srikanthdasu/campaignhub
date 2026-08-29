'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { useClientPicker } from '@/hooks/use-client-picker';
import { ClientPicker } from '@/components/client-picker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

const CONTENT_TYPES = ['CAPTION', 'IMAGE', 'VIDEO', 'POST'] as const;
const PLATFORMS = [
  'INSTAGRAM',
  'FACEBOOK',
  'LINKEDIN',
  'X',
  'TIKTOK',
  'YOUTUBE',
  'PINTEREST',
  'WHATSAPP',
] as const;

const STATUS_TONE: Record<string, 'accent' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  DRAFT: 'neutral',
  IN_REVIEW: 'accent',
  CHANGES_REQUESTED: 'warning',
  APPROVED: 'success',
  SCHEDULED: 'accent',
  PUBLISHED: 'success',
  REJECTED: 'danger',
};

interface ContentItem {
  id: string;
  type: (typeof CONTENT_TYPES)[number];
  body: string | null;
  platforms: string[];
  status: keyof typeof STATUS_TONE;
  createdAt: string;
  mediaAsset: { id: string; fileName: string } | null;
}

interface Member {
  id: string;
  name: string;
  role: string;
}

export default function ContentPlannerPage() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();
  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [type, setType] = useState<(typeof CONTENT_TYPES)[number]>('CAPTION');
  const [body, setBody] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);

  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const [mode, setMode] = useState<'SEQUENTIAL' | 'PARALLEL'>('SEQUENTIAL');

  function loadItems(clientId: string) {
    api
      .get<ContentItem[]>(`/clients/${clientId}/content`)
      .then(setItems)
      .catch(() => setItems([]));
  }

  useEffect(() => {
    if (!selectedClientId) return;
    loadItems(selectedClientId);
    api
      .get<Member[]>(`/clients/${selectedClientId}/access`)
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [selectedClientId]);

  function togglePlatform(p: string) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!selectedClientId) return;
    setError(null);
    setCreating(true);
    try {
      await api.post(`/clients/${selectedClientId}/content`, { type, body, platforms });
      setBody('');
      setPlatforms([]);
      loadItems(selectedClientId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create content');
    } finally {
      setCreating(false);
    }
  }

  function toggleApprover(id: string) {
    setApproverIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onSubmitForApproval(id: string) {
    if (!selectedClientId || approverIds.length === 0) return;
    try {
      await api.post(`/clients/${selectedClientId}/content/${id}/submit`, {
        approverIds,
        mode,
      });
      setSubmittingId(null);
      setApproverIds([]);
      loadItems(selectedClientId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit for approval');
    }
  }

  return (
    <motion.div
      variants={staggerContainer(0.08)}
      initial="hidden"
      animate="show"
      className="max-w-3xl space-y-6"
    >
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Content Planner</h1>
        <p className="text-sm text-neutral-400">
          Create content, pick platforms, and send it for approval.
        </p>
      </motion.div>

      {clients && clients.length === 0 ? (
        <Card padding="lg">
          <p className="text-sm text-neutral-400">
            No clients yet — create one from Agency &amp; Clients first.
          </p>
        </Card>
      ) : (
        <>
          {clients && (
            <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
              <ClientPicker clients={clients} value={selectedClientId} onChange={setSelectedClientId} />
            </motion.div>
          )}

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
              <h2 className="mb-4 text-sm font-semibold text-neutral-50">New content</h2>
              <form onSubmit={onCreate} className="space-y-4">
                <Select
                  label="Type"
                  value={type}
                  onChange={(e) => setType(e.target.value as (typeof CONTENT_TYPES)[number])}
                >
                  {CONTENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-neutral-300">Body / caption</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none transition-all duration-200 placeholder:text-neutral-500 hover:border-white/20 focus:border-accent-400 focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_rgba(91,99,245,0.18)]"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-sm font-medium text-neutral-300">Platforms</span>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map((p) => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => togglePlatform(p)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          platforms.includes(p)
                            ? 'border-accent-400/40 bg-accent-500/15 text-accent-200'
                            : 'border-white/12 bg-white/[0.03] text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <Button type="submit" loading={creating}>
                  {creating ? 'Creating…' : 'Create draft'}
                </Button>
              </form>
            </Card>
          </motion.div>

          <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
            {items === null ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
              </div>
            ) : items.length === 0 ? (
              <Card padding="lg">
                <p className="text-sm text-neutral-400">No content yet.</p>
              </Card>
            ) : (
              <ul className="space-y-3">
                <AnimatePresence initial={false}>
                  {items.map((item) => (
                    <motion.li
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: DURATION.base, ease: EASE_SOFT }}
                    >
                      <Card padding="lg">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge tone="neutral">{item.type}</Badge>
                              <Badge tone={STATUS_TONE[item.status]}>{item.status}</Badge>
                              {item.platforms.map((p) => (
                                <span key={p} className="text-xs text-neutral-500">
                                  {p}
                                </span>
                              ))}
                            </div>
                            {item.body && (
                              <p className="mt-2 line-clamp-2 text-sm text-neutral-300">{item.body}</p>
                            )}
                          </div>
                          {(item.status === 'DRAFT' || item.status === 'CHANGES_REQUESTED') && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                setSubmittingId(submittingId === item.id ? null : item.id)
                              }
                            >
                              Submit for approval
                            </Button>
                          )}
                        </div>

                        <AnimatePresence>
                          {submittingId === item.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="mt-4 overflow-hidden border-t border-white/10 pt-4"
                            >
                              <p className="mb-2 text-xs font-medium text-neutral-300">
                                Choose approvers
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {members.map((m) => (
                                  <button
                                    key={m.id}
                                    onClick={() => toggleApprover(m.id)}
                                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                      approverIds.includes(m.id)
                                        ? 'border-accent-400/40 bg-accent-500/15 text-accent-200'
                                        : 'border-white/12 bg-white/[0.03] text-neutral-400'
                                    }`}
                                  >
                                    {m.name}
                                  </button>
                                ))}
                                {members.length === 0 && (
                                  <p className="text-xs text-neutral-500">
                                    No other members have access to this client yet.
                                  </p>
                                )}
                              </div>
                              <div className="mt-3 flex items-center gap-4 text-xs text-neutral-400">
                                <label className="flex items-center gap-1.5">
                                  <input
                                    type="radio"
                                    checked={mode === 'SEQUENTIAL'}
                                    onChange={() => setMode('SEQUENTIAL')}
                                  />
                                  Sequential
                                </label>
                                <label className="flex items-center gap-1.5">
                                  <input
                                    type="radio"
                                    checked={mode === 'PARALLEL'}
                                    onChange={() => setMode('PARALLEL')}
                                  />
                                  Parallel
                                </label>
                              </div>
                              <Button
                                size="sm"
                                className="mt-3"
                                disabled={approverIds.length === 0}
                                onClick={() => onSubmitForApproval(item.id)}
                              >
                                Confirm submission
                              </Button>
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
        </>
      )}
    </motion.div>
  );
}
