'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { useClientPicker } from '@/hooks/use-client-picker';
import { ClientPicker } from '@/components/client-picker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

interface ContentItem {
  id: string;
  type: string;
  body: string | null;
  platforms: string[];
  status: string;
}

interface ScheduledPost {
  id: string;
  platform: string;
  scheduledTime: string;
  status: 'PENDING' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED';
  contentItem: { id: string; type: string; body: string | null };
}

const POST_TONE: Record<string, 'accent' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  PENDING: 'accent',
  PUBLISHING: 'warning',
  PUBLISHED: 'success',
  FAILED: 'danger',
};

export default function SchedulerPage() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();
  const [approved, setApproved] = useState<ContentItem[] | null>(null);
  const [posts, setPosts] = useState<ScheduledPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduledTime, setScheduledTime] = useState('');

  function load(clientId: string) {
    api
      .get<ContentItem[]>(`/clients/${clientId}/content?status=APPROVED`)
      .then(setApproved)
      .catch(() => setApproved([]));
    api
      .get<ScheduledPost[]>(`/clients/${clientId}/scheduled-posts`)
      .then(setPosts)
      .catch(() => setPosts([]));
  }

  useEffect(() => {
    if (selectedClientId) load(selectedClientId);
  }, [selectedClientId]);

  async function onSchedule(contentId: string) {
    if (!selectedClientId || !scheduledTime) return;
    setError(null);
    try {
      await api.post(`/clients/${selectedClientId}/content/${contentId}/schedule`, {
        scheduledTime: new Date(scheduledTime).toISOString(),
      });
      setSchedulingId(null);
      setScheduledTime('');
      load(selectedClientId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to schedule');
    }
  }

  async function onCancel(id: string) {
    if (!selectedClientId) return;
    try {
      await api.delete(`/scheduled-posts/${id}`);
      load(selectedClientId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to cancel');
    }
  }

  async function onMarkPublished(id: string) {
    if (!selectedClientId) return;
    try {
      await api.post(`/scheduled-posts/${id}/publish`);
      load(selectedClientId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to mark published');
    }
  }

  return (
    <motion.div
      variants={staggerContainer(0.08)}
      initial="hidden"
      animate="show"
      className="max-w-3xl space-y-8"
    >
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Scheduler</h1>
        <p className="text-sm text-neutral-400">
          Schedule approved content and track what&apos;s queued to publish.
        </p>
        <p className="mt-2 text-xs text-amber-300/80">
          Posts publish automatically once their scheduled time passes — a background job
          checks every minute, so this keeps working even if nobody has the app open. &quot;Mark
          published&quot; below is only for publishing early. Actual delivery to each platform
          is still simulated until real OAuth connections (Phase 3) exist.
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

          {error && (
            <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
              {error}
            </p>
          )}

          <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
            <h2 className="mb-3 text-sm font-semibold text-neutral-50">
              Approved content ready to schedule
            </h2>
            {approved === null ? (
              <Skeleton className="h-16 w-full rounded-2xl" />
            ) : approved.length === 0 ? (
              <Card padding="lg">
                <p className="text-sm text-neutral-400">Nothing approved and waiting yet.</p>
              </Card>
            ) : (
              <ul className="space-y-3">
                {approved.map((item) => (
                  <Card key={item.id} padding="lg">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge tone="neutral">{item.type}</Badge>
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
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSchedulingId(schedulingId === item.id ? null : item.id)}
                      >
                        Schedule
                      </Button>
                    </div>

                    <AnimatePresence>
                      {schedulingId === item.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-4 overflow-hidden border-t border-white/10 pt-4"
                        >
                          <div className="flex items-end gap-3">
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium text-neutral-300">
                                Date &amp; time
                              </label>
                              <input
                                type="datetime-local"
                                value={scheduledTime}
                                onChange={(e) => setScheduledTime(e.target.value)}
                                className="rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-sm text-neutral-50 outline-none focus:border-accent-400"
                              />
                            </div>
                            <Button
                              size="sm"
                              disabled={!scheduledTime}
                              onClick={() => onSchedule(item.id)}
                            >
                              Confirm
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                ))}
              </ul>
            )}
          </motion.div>

          <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
            <h2 className="mb-3 text-sm font-semibold text-neutral-50">Scheduled posts</h2>
            {posts === null ? (
              <Skeleton className="h-16 w-full rounded-2xl" />
            ) : posts.length === 0 ? (
              <Card padding="lg">
                <p className="text-sm text-neutral-400">Nothing scheduled yet.</p>
              </Card>
            ) : (
              <ul className="space-y-3">
                <AnimatePresence initial={false}>
                  {posts.map((post) => (
                    <motion.li
                      key={post.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: DURATION.base, ease: EASE_SOFT }}
                    >
                      <Card padding="md" className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge tone="neutral">{post.platform}</Badge>
                            <Badge tone={POST_TONE[post.status]}>{post.status}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-neutral-500">
                            {new Date(post.scheduledTime).toLocaleString()}
                          </p>
                        </div>
                        {post.status === 'PENDING' && (
                          <div className="flex shrink-0 gap-2">
                            <Button size="sm" onClick={() => onMarkPublished(post.id)}>
                              Mark published
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => onCancel(post.id)}>
                              Cancel
                            </Button>
                          </div>
                        )}
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
