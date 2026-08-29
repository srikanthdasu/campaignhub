'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

interface Step {
  id: string;
  approverId: string | null;
  stepOrder: number | null;
  decision: 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED';
  comment: string | null;
}

interface Flow {
  id: string;
  mode: 'SEQUENTIAL' | 'PARALLEL';
  status: string;
  contentItem: { id: string; type: string; body: string | null; client: { name: string } };
  steps: Step[];
}

const FLOW_TONE: Record<string, 'accent' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  IN_REVIEW: 'accent',
  CHANGES_REQUESTED: 'warning',
  RE_SUBMITTED: 'accent',
  APPROVED: 'success',
  REJECTED: 'danger',
  COMPLETED: 'success',
};

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [flows, setFlows] = useState<Flow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commentByStep, setCommentByStep] = useState<Record<string, string>>({});

  function load() {
    api
      .get<Flow[]>('/approvals')
      .then(setFlows)
      .catch(() => setFlows([]));
  }

  useEffect(load, []);

  async function decide(
    flowId: string,
    stepId: string,
    decision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED',
  ) {
    setError(null);
    try {
      await api.post(`/approvals/${flowId}/steps/${stepId}/decide`, {
        decision,
        comment: commentByStep[stepId],
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record decision');
    }
  }

  function myPendingStep(flow: Flow): Step | undefined {
    if (!user) return undefined;
    if (flow.mode === 'SEQUENTIAL') {
      const nextPending = [...flow.steps]
        .filter((s) => s.decision === 'PENDING')
        .sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))[0];
      return nextPending?.approverId === user.id ? nextPending : undefined;
    }
    return flow.steps.find((s) => s.approverId === user.id && s.decision === 'PENDING');
  }

  return (
    <motion.div
      variants={staggerContainer(0.08)}
      initial="hidden"
      animate="show"
      className="max-w-3xl space-y-6"
    >
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Approvals</h1>
        <p className="text-sm text-neutral-400">
          Content submitted for review — yours to decide, or your agency&apos;s in flight.
        </p>
      </motion.div>

      {error && (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        {flows === null ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
        ) : flows.length === 0 ? (
          <Card padding="lg">
            <p className="text-sm text-neutral-400">Nothing waiting on approval right now.</p>
          </Card>
        ) : (
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {flows.map((flow) => {
                const myStep = myPendingStep(flow);
                return (
                  <motion.li
                    key={flow.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: DURATION.base, ease: EASE_SOFT }}
                  >
                    <Card padding="lg">
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">{flow.contentItem.client.name}</Badge>
                        <Badge tone="neutral">{flow.contentItem.type}</Badge>
                        <Badge tone={FLOW_TONE[flow.status] ?? 'neutral'}>{flow.status}</Badge>
                        <span className="text-xs text-neutral-500">{flow.mode}</span>
                      </div>
                      {flow.contentItem.body && (
                        <p className="mt-2 line-clamp-2 text-sm text-neutral-300">
                          {flow.contentItem.body}
                        </p>
                      )}

                      <ul className="mt-3 space-y-1 text-xs text-neutral-500">
                        {flow.steps.map((s) => (
                          <li key={s.id}>
                            Step {s.stepOrder ?? '—'}: {s.decision}
                            {s.comment ? ` — "${s.comment}"` : ''}
                          </li>
                        ))}
                      </ul>

                      {myStep && (
                        <div className="mt-4 border-t border-white/10 pt-4">
                          <input
                            placeholder="Add a comment (optional)"
                            value={commentByStep[myStep.id] ?? ''}
                            onChange={(e) =>
                              setCommentByStep((prev) => ({ ...prev, [myStep.id]: e.target.value }))
                            }
                            className="mb-3 w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => decide(flow.id, myStep.id, 'APPROVED')}>
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => decide(flow.id, myStep.id, 'CHANGES_REQUESTED')}
                            >
                              Request changes
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => decide(flow.id, myStep.id, 'REJECTED')}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </motion.div>
    </motion.div>
  );
}
