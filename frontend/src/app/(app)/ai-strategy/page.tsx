'use client';

import { FormEvent, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useClientPicker } from '@/hooks/use-client-picker';
import { ClientPicker } from '@/components/client-picker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import { Plus, Sparkles, Star, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';

type Status = 'DRAFT' | 'GENERATED' | 'APPROVED' | 'REJECTED';

interface StrategyRequest {
  id: string;
  title: string;
  goal: string | null;
  context: { note?: string } | null;
  output: string | null;
  status: Status;
  reviewNote: string | null;
  feedbackRating: number | null;
  updatedAt: string;
}

const STATUS_TONE: Record<Status, 'neutral' | 'accent' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  GENERATED: 'accent',
  APPROVED: 'success',
  REJECTED: 'danger',
};

const CAN_REVIEW_ROLES = ['OWNER', 'ADMIN', 'MANAGER'];

export default function AiStrategyPage() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();

  return (
    <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">AI Strategy &amp; Governance</h1>
        <p className="text-sm text-neutral-400">
          AI uses permitted context, produces traceable outputs, and improves through measured
          feedback.
        </p>
        <p className="mt-2 text-xs text-amber-300/80">
          No Anthropic API key is configured, so generated strategy text below comes from
          heuristics rather than a real Claude call. The Context → Plan → Generate → Review →
          Learn approval gate is fully functional regardless of which provider is behind it.
        </p>
      </motion.div>

      {clients && clients.length === 0 ? (
        <Card padding="lg">
          <p className="text-sm text-neutral-400">No clients yet — create one from Agency &amp; Clients first.</p>
        </Card>
      ) : (
        <>
          {clients && (
            <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
              <ClientPicker clients={clients} value={selectedClientId} onChange={setSelectedClientId} />
            </motion.div>
          )}

          {selectedClientId && <StrategyWorkspace key={selectedClientId} clientId={selectedClientId} />}
        </>
      )}
    </motion.div>
  );
}

function StrategyWorkspace({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const canReview = !!user && CAN_REVIEW_ROLES.includes(user.role);
  const [requests, setRequests] = useState<StrategyRequest[] | null>(null);
  const [active, setActive] = useState<StrategyRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [contextNote, setContextNote] = useState('');
  const [reviewNote, setReviewNote] = useState('');

  function loadRequests() {
    api
      .get<StrategyRequest[]>(`/clients/${clientId}/ai-strategy`)
      .then(setRequests)
      .catch(() => setRequests([]));
  }

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshActive(id: string) {
    const request = await api.get<StrategyRequest>(`/clients/${clientId}/ai-strategy/${id}`);
    setActive(request);
    setReviewNote(request.reviewNote ?? '');
    loadRequests();
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const request = await api.post<StrategyRequest>(`/clients/${clientId}/ai-strategy`, {
        title,
        goal,
        contextNote,
      });
      setTitle('');
      setGoal('');
      setContextNote('');
      await refreshActive(request.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create strategy request');
    } finally {
      setBusy(false);
    }
  }

  async function onGenerate() {
    if (!active) return;
    setBusy(true);
    try {
      await api.post(`/clients/${clientId}/ai-strategy/${active.id}/generate`);
      await refreshActive(active.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate strategy');
    } finally {
      setBusy(false);
    }
  }

  async function onReview(status: 'APPROVED' | 'REJECTED') {
    if (!active) return;
    setBusy(true);
    try {
      await api.post(`/clients/${clientId}/ai-strategy/${active.id}/review`, { status, reviewNote });
      await refreshActive(active.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit review');
    } finally {
      setBusy(false);
    }
  }

  async function onFeedback(rating: number) {
    if (!active) return;
    try {
      await api.post(`/clients/${clientId}/ai-strategy/${active.id}/feedback`, { rating });
      await refreshActive(active.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit feedback');
    }
  }

  async function onDelete(id: string) {
    await api.delete(`/clients/${clientId}/ai-strategy/${id}`);
    if (active?.id === id) setActive(null);
    loadRequests();
  }

  return (
    <>
      {error && (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ duration: DURATION.base, ease: EASE_SOFT }}
        className="mt-4 grid grid-cols-[280px_1fr] gap-4"
      >
        <Card padding="sm" className="space-y-3">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">Requests</h2>
          <div className="space-y-1">
            {requests === null ? (
              <Skeleton className="h-10 w-full" />
            ) : requests.length === 0 ? (
              <p className="px-2 text-xs text-neutral-500">No strategy requests yet.</p>
            ) : (
              requests.map((r) => (
                <div
                  key={r.id}
                  className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-xs ${
                    active?.id === r.id ? 'bg-accent-500/15 text-accent-200' : 'text-neutral-400 hover:bg-white/[0.05]'
                  }`}
                >
                  <button onClick={() => refreshActive(r.id)} className="flex-1 truncate text-left" title={r.title}>
                    {r.title}
                  </button>
                  <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                  {canReview && (
                    <button onClick={() => onDelete(r.id)} className="shrink-0 opacity-0 group-hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5 text-neutral-500 hover:text-red-400" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-white/10 pt-3">
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              New strategy
            </h2>
            <form onSubmit={onCreate} className="space-y-2 px-1">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                required
                className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-2 text-xs text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
              />
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Goal / objective"
                className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-2 text-xs text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
              />
              <textarea
                value={contextNote}
                onChange={(e) => setContextNote(e.target.value)}
                placeholder="Context (permitted data / notes)"
                rows={2}
                className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-2 text-xs text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
              />
              <Button type="submit" size="sm" className="w-full" loading={busy}>
                <Plus className="h-3.5 w-3.5" /> Create
              </Button>
            </form>
          </div>
        </Card>

        <div>
          {!active ? (
            <Card padding="lg">
              <p className="text-sm text-neutral-400">
                Select a request on the left, or create a new one to start the flow.
              </p>
            </Card>
          ) : (
            <Card padding="lg" className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-50">{active.title}</h3>
                <Badge tone={STATUS_TONE[active.status]}>{active.status}</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">1. Context</p>
                  <p className="text-sm text-neutral-300">{active.context?.note || 'No context provided.'}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">2. Plan</p>
                  <p className="text-sm text-neutral-300">{active.goal || 'No goal specified.'}</p>
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">3. Generate</p>
                {active.output ? (
                  <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-sm text-neutral-300">
                    {active.output}
                  </pre>
                ) : (
                  <Button size="sm" onClick={onGenerate} loading={busy}>
                    <Sparkles className="h-3.5 w-3.5" /> Generate Strategy
                  </Button>
                )}
              </div>

              {active.status === 'GENERATED' && (
                <div className="space-y-2 border-t border-white/10 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">4. Review</p>
                  {canReview ? (
                    <>
                      <textarea
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder="Review note (optional)"
                        rows={2}
                        className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => onReview('APPROVED')} loading={busy}>
                          <ThumbsUp className="h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => onReview('REJECTED')} loading={busy}>
                          <ThumbsDown className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-neutral-400">
                      Waiting on an Owner, Admin, or Manager to review this output.
                    </p>
                  )}
                </div>
              )}

              {(active.status === 'APPROVED' || active.status === 'REJECTED') && (
                <div className="space-y-2 border-t border-white/10 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">5. Learn</p>
                  {active.reviewNote && <p className="text-sm text-neutral-300">Review note: {active.reviewNote}</p>}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-400">Rate this result:</span>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => onFeedback(n)}>
                        <Star
                          className={`h-4 w-4 ${
                            active.feedbackRating && n <= active.feedbackRating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-neutral-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </motion.div>
    </>
  );
}
