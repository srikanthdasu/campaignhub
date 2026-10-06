'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ApiError } from '@/lib/api';
import { ClientPicker } from '@/components/client-picker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { DURATION, EASE_SOFT, fadeUp } from '@/lib/motion';
import {
  PenSquare,
  Users,
  Share2,
  CalendarClock,
  FileText,
  Eye,
  ClipboardCheck,
  Send,
  BarChart3,
  Zap,
} from 'lucide-react';
import { PanelHeader } from './components/panel-header';
import { isSameLocalDay } from './utils';
import {
  cancelScheduledPost,
  createDraft,
  fetchApprovedContent,
  fetchMediaAssets,
  fetchScheduledPosts,
  publishScheduledPost,
  rescheduleScheduledPost,
  retryScheduledPost,
  scheduleContent,
} from './api/scheduler-api';
import {
  CONTENT_TYPES,
  PLATFORMS,
  POST_TONE,
  MAX_RETRIES,
  REAL_PUBLISH_PLATFORMS,
  type ContentItem,
  type ScheduledPost,
} from './types';

export function SchedulerWorkspace({
  clientId,
  clients,
  selectedClientId,
  setSelectedClientId,
  prefillMediaAssetId,
}: {
  clientId: string;
  clients: { id: string; name: string }[];
  selectedClientId: string;
  setSelectedClientId: (id: string) => void;
  prefillMediaAssetId: string | null;
}) {
  const [approved, setApproved] = useState<ContentItem[] | null>(null);
  const [posts, setPosts] = useState<ScheduledPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [createTab, setCreateTab] = useState<'existing' | 'new'>(prefillMediaAssetId ? 'new' : 'existing');
  const [newType, setNewType] = useState<(typeof CONTENT_TYPES)[number]>('CAPTION');
  const [newBody, setNewBody] = useState('');
  const [newMediaAssetId, setNewMediaAssetId] = useState(prefillMediaAssetId ?? '');
  const [mediaAssets, setMediaAssets] = useState<{ id: string; fileName: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [createdNote, setCreatedNote] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [schedulePlatforms, setSchedulePlatforms] = useState<string[]>([]);
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [publishingNow, setPublishingNow] = useState(false);
  const [justScheduled, setJustScheduled] = useState<ScheduledPost[] | null>(null);

  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleDateTime, setRescheduleDateTime] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  function load() {
    fetchApprovedContent(clientId).then(setApproved).catch(() => setApproved([]));
    fetchScheduledPosts(clientId).then(setPosts).catch(() => setPosts([]));
    fetchMediaAssets(clientId).then(setMediaAssets).catch(() => setMediaAssets([]));
  }

  useEffect(load, [clientId]);

  function selectItem(item: ContentItem) {
    setSelectedItem(item);
    setSchedulePlatforms(item.platforms);
    setJustScheduled(null);
  }

  function togglePlatform(p: string) {
    setSchedulePlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function onCreateDraft(e: FormEvent) {
    e.preventDefault();
    if (!newBody.trim()) return;
    setError(null);
    setCreating(true);
    setCreatedNote(null);
    try {
      await createDraft(clientId, {
        type: newType,
        body: newBody,
        mediaAssetId: newMediaAssetId || undefined,
      });
      setNewBody('');
      setNewMediaAssetId('');
      setCreatedNote('Draft created — submit it for approval in Content Planner before it can be scheduled here.');
      setCreateTab('existing');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create draft');
    } finally {
      setCreating(false);
    }
  }

  async function onSchedule() {
    if (!selectedItem || !scheduleDateTime) return;
    setError(null);
    setScheduling(true);
    try {
      const created = await scheduleContent(clientId, selectedItem.id, {
        scheduledTime: new Date(scheduleDateTime).toISOString(),
        platforms: schedulePlatforms.length ? schedulePlatforms : undefined,
      });
      setJustScheduled(created);
      setSelectedItem(null);
      setScheduleDateTime('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to schedule');
    } finally {
      setScheduling(false);
    }
  }

  async function onPublishNow() {
    if (!selectedItem) return;
    setError(null);
    setPublishingNow(true);
    try {
      const created = await scheduleContent(clientId, selectedItem.id, {
        scheduledTime: new Date().toISOString(),
        platforms: schedulePlatforms.length ? schedulePlatforms : undefined,
      });
      await Promise.all(created.map((p) => publishScheduledPost(p.id)));
      setSelectedItem(null);
      setScheduleDateTime('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to publish now');
    } finally {
      setPublishingNow(false);
    }
  }

  async function onCancel(id: string) {
    try {
      await cancelScheduledPost(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to cancel');
    }
  }

  async function onReschedule(id: string) {
    if (!rescheduleDateTime) return;
    setError(null);
    setRescheduling(true);
    try {
      await rescheduleScheduledPost(id, {
        scheduledTime: new Date(rescheduleDateTime).toISOString(),
      });
      setReschedulingId(null);
      setRescheduleDateTime('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reschedule');
    } finally {
      setRescheduling(false);
    }
  }

  async function onMarkPublished(id: string) {
    try {
      await publishScheduledPost(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to mark published');
    }
  }

  async function onRetry(id: string) {
    try {
      await retryScheduledPost(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to retry');
    }
  }

  const disabled = !selectedItem;
  const now = new Date();
  const pending = posts?.filter((p) => p.status === 'PENDING') ?? [];
  const publishing = posts?.filter((p) => p.status === 'PUBLISHING') ?? [];
  const published = posts?.filter((p) => p.status === 'PUBLISHED') ?? [];
  const failed = posts?.filter((p) => p.status === 'FAILED') ?? [];
  const dueToday = pending.filter((p) => isSameLocalDay(p.scheduledTime, now));
  const completedToday = published.filter((p) => p.publishedAt && isSameLocalDay(p.publishedAt, now));
  const upcoming = [...pending].sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)).slice(0, 5);

  return (
    <>
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <ClientPicker clients={clients} value={selectedClientId} onChange={setSelectedClientId} />
      </motion.div>

      {error && (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Create Content */}
          <Card padding="lg" className="sm:col-span-2 lg:col-span-2">
            <PanelHeader n={1} title="Create Content" icon={PenSquare} color="#8b5cf6" />
            <div className="mb-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => setCreateTab('existing')}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  createTab === 'existing'
                    ? 'border-accent-400/40 bg-accent-500/15 text-accent-200'
                    : 'border-white/12 bg-white/[0.03] text-neutral-400'
                }`}
              >
                Use Existing
              </button>
              <button
                type="button"
                onClick={() => setCreateTab('new')}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  createTab === 'new'
                    ? 'border-accent-400/40 bg-accent-500/15 text-accent-200'
                    : 'border-white/12 bg-white/[0.03] text-neutral-400'
                }`}
              >
                Create New
              </button>
            </div>

            {createTab === 'existing' ? (
              approved === null ? (
                <Skeleton className="h-16 w-full" />
              ) : approved.length === 0 ? (
                <p className="text-xs text-neutral-500">Nothing approved and waiting yet.</p>
              ) : (
                <ul className="max-h-56 space-y-1.5 overflow-y-auto">
                  {approved.map((item) => (
                    <li key={item.id}>
                      <button
                        onClick={() => selectItem(item)}
                        className={`w-full min-w-0 rounded-lg border px-2.5 py-1.5 text-left text-xs ${
                          selectedItem?.id === item.id
                            ? 'border-accent-400/40 bg-accent-500/15 text-accent-200'
                            : 'border-white/10 text-neutral-300 hover:bg-white/[0.05]'
                        }`}
                      >
                        <span className="truncate">{item.body || item.type}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <form onSubmit={onCreateDraft} className="space-y-2">
                <Select value={newType} onChange={(e) => setNewType(e.target.value as (typeof CONTENT_TYPES)[number])}>
                  {CONTENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
                <Textarea
                  placeholder="Write something amazing…"
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  rows={3}
                />
                <Select value={newMediaAssetId} onChange={(e) => setNewMediaAssetId(e.target.value)}>
                  <option value="">No media</option>
                  {mediaAssets.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fileName}
                    </option>
                  ))}
                </Select>
                <Button type="submit" size="sm" loading={creating} disabled={!newBody.trim()}>
                  Save Draft
                </Button>
                {createdNote && <p className="text-[11px] text-neutral-500">{createdNote}</p>}
                <p className="text-[11px] text-neutral-500">
                  Need a new AI image first? Generate one in{' '}
                  <Link href="/ai-image-studio" className="text-accent-300 hover:underline">
                    AI Image
                  </Link>{' '}
                  — it&apos;ll show up in the dropdown above. For AI captions, use{' '}
                  <Link href="/ai-captions" className="text-accent-300 hover:underline">
                    AI Captions
                  </Link>{' '}
                  and paste the text in.
                </p>
              </form>
            )}
          </Card>

          {/* 3. Select Accounts */}
          <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
            <PanelHeader n={3} title="Select Accounts" icon={Share2} color="#0ea5e9" />
            {disabled ? (
              <p className="text-xs text-neutral-500">Choose content from panel 1 first.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      schedulePlatforms.includes(p)
                        ? 'border-accent-400/40 bg-accent-500/15 text-accent-200'
                        : 'border-white/12 bg-white/[0.03] text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* 4. Set Date & Time */}
          <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
            <PanelHeader n={4} title="Set Date & Time" icon={CalendarClock} color="#22c55e" />
            {disabled ? (
              <p className="text-xs text-neutral-500">Choose content from panel 1 first.</p>
            ) : (
              <div className="space-y-2">
                <input
                  type="datetime-local"
                  value={scheduleDateTime}
                  onChange={(e) => setScheduleDateTime(e.target.value)}
                  className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-xs text-neutral-50 outline-none focus:border-accent-400"
                />
                <p className="text-[11px] text-neutral-500">Uses your device&apos;s local time zone.</p>
                <p className="text-[11px] text-neutral-500">Repeat: not available yet.</p>
              </div>
            )}
          </Card>

          {/* 5. Add Details */}
          <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
            <PanelHeader n={5} title="Add Details" icon={FileText} color="#f43f5e" />
            {disabled ? (
              <p className="text-xs text-neutral-500">Choose content from panel 1 first.</p>
            ) : (
              <div className="space-y-1.5">
                <Badge tone="neutral">{selectedItem.type}</Badge>
                <p className="max-h-24 overflow-y-auto whitespace-pre-wrap text-xs text-neutral-300">
                  {selectedItem.body || '—'}
                </p>
                <p className="text-[11px] text-neutral-500">
                  <Link href="/content-planner" className="text-accent-300 hover:underline">
                    Edit in Content Planner
                  </Link>{' '}
                  (only while it&apos;s a draft).
                </p>
              </div>
            )}
          </Card>

          {/* 6. Preview */}
          <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
            <PanelHeader n={6} title="Preview" icon={Eye} color="#d946ef" />
            {disabled ? (
              <p className="text-xs text-neutral-500">Choose content from panel 1 first.</p>
            ) : schedulePlatforms.length === 0 ? (
              <p className="text-xs text-neutral-500">Pick at least one platform in panel 3.</p>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {schedulePlatforms.map((p) => (
                  <div key={p} className="rounded-lg border border-white/10 p-2">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{p}</p>
                    {selectedItem.mediaAsset && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedItem.mediaAsset.storageUrl}
                        alt={selectedItem.mediaAsset.fileName}
                        className="mb-1.5 h-20 w-full rounded object-cover"
                      />
                    )}
                    <p className="line-clamp-3 text-xs text-neutral-300">{selectedItem.body}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 7. Schedule */}
          <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
            <PanelHeader n={7} title="Schedule" icon={ClipboardCheck} color="#f97316" />
            {disabled ? (
              <p className="text-xs text-neutral-500">Choose content from panel 1 first.</p>
            ) : (
              <div className="space-y-1.5 text-[11px] text-neutral-400">
                <p>
                  Accounts: <span className="text-neutral-200">{schedulePlatforms.join(', ') || '—'}</span>
                </p>
                <p>
                  When:{' '}
                  <span className="text-neutral-200">
                    {scheduleDateTime ? new Date(scheduleDateTime).toLocaleString() : '—'}
                  </span>
                </p>
                <Button
                  size="sm"
                  className="w-full"
                  loading={scheduling}
                  disabled={!scheduleDateTime || schedulePlatforms.length === 0}
                  onClick={onSchedule}
                >
                  Schedule Post
                </Button>
              </div>
            )}
          </Card>

          {/* 8. Publish (Automatic) */}
          <Card padding="lg" className={disabled && !justScheduled ? 'opacity-50' : ''}>
            <PanelHeader n={8} title="Publish (Automatic)" icon={Send} color="#14b8a6" />
            {justScheduled ? (
              <p className="text-xs text-emerald-300">
                Scheduled — will publish automatically at {new Date(justScheduled[0].scheduledTime).toLocaleString()}.
              </p>
            ) : disabled ? (
              <p className="text-xs text-neutral-500">Choose content from panel 1 first.</p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[11px] text-neutral-500">
                  A background job auto-publishes scheduled posts every minute — or skip the wait:
                </p>
                <Button
                  size="sm"
                  className="w-full"
                  loading={publishingNow}
                  disabled={schedulePlatforms.length === 0}
                  onClick={onPublishNow}
                >
                  <Zap className="h-3.5 w-3.5" /> Publish Now
                </Button>
              </div>
            )}
          </Card>

          {/* 9. Track & Analyze */}
          <Card padding="lg">
            <PanelHeader n={9} title="Track & Analyze" icon={BarChart3} color="#eab308" />
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] py-2">
                <p className="text-base font-semibold text-neutral-100">{pending.length}</p>
                <p className="text-neutral-500">Pending</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] py-2">
                <p className="text-base font-semibold text-neutral-100">{published.length}</p>
                <p className="text-neutral-500">Published</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] py-2">
                <p className="text-base font-semibold text-neutral-100">{publishing.length}</p>
                <p className="text-neutral-500">Publishing</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] py-2">
                <p className="text-base font-semibold text-neutral-100">{failed.length}</p>
                <p className="text-neutral-500">Failed</p>
              </div>
            </div>
            {failed.length > 0 && (
              <p className="mt-2 truncate text-[11px] text-red-400" title={failed[0].errorMessage ?? undefined}>
                {failed[0].errorMessage}
              </p>
            )}
            <p className="mt-2 text-[11px] text-amber-300/80">
              Reach, engagement, likes, and saves need a connected analytics provider — not available yet.
            </p>
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <Card padding="lg">
            <h2 className="mb-3 text-sm font-semibold text-neutral-50">Scheduler Overview</h2>
            <ul className="space-y-1.5 text-xs">
              <li className="flex items-center justify-between text-neutral-400">
                <span>Total Scheduled</span>
                <span className="font-medium text-neutral-100">{pending.length}</span>
              </li>
              <li className="flex items-center justify-between text-neutral-400">
                <span>Due Today</span>
                <span className="font-medium text-neutral-100">{dueToday.length}</span>
              </li>
              <li className="flex items-center justify-between text-neutral-400">
                <span>Completed Today</span>
                <span className="font-medium text-neutral-100">{completedToday.length}</span>
              </li>
              <li className="flex items-center justify-between text-neutral-400">
                <span>Failed / Error</span>
                <span className="font-medium text-neutral-100">{failed.length}</span>
              </li>
            </ul>
          </Card>

          <Card padding="lg">
            <h2 className="mb-3 text-sm font-semibold text-neutral-50">Upcoming Posts</h2>
            {upcoming.length === 0 ? (
              <p className="text-xs text-neutral-500">Nothing scheduled yet.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((p) => (
                  <li key={p.id} className="text-xs">
                    <p className="text-neutral-300">
                      <Badge tone="neutral">{p.platform}</Badge>
                    </p>
                    <p className="mt-1 truncate text-neutral-400">{p.contentItem.body || p.contentItem.type}</p>
                    <p className="text-[11px] text-neutral-500">{new Date(p.scheduledTime).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card padding="lg">
            <h2 className="mb-3 text-sm font-semibold text-neutral-50">Quick Actions</h2>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/content-planner" className="font-medium text-accent-300 hover:underline">
                  Create New Post →
                </Link>
              </li>
              <li>
                <Link href="/approvals" className="font-medium text-accent-300 hover:underline">
                  Approval Queue →
                </Link>
              </li>
              <li>
                <Link href="/campaigns" className="font-medium text-accent-300 hover:underline">
                  Campaigns →
                </Link>
              </li>
            </ul>
          </Card>
        </div>
      </div>

      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h2 className="mb-3 text-sm font-semibold text-neutral-50">All Scheduled Posts</h2>
        {posts === null ? (
          <Skeleton className="h-16 w-full rounded-2xl" />
        ) : posts.length === 0 ? (
          <Card padding="lg">
            <p className="text-sm text-neutral-400">Nothing scheduled yet.</p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {posts.map((post) => {
              const canReschedule = post.status === 'PENDING' || post.status === 'FAILED';
              return (
                <Card key={post.id} padding="md">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">{post.platform}</Badge>
                        <Badge tone={POST_TONE[post.status]}>{post.status}</Badge>
                        {(post.status === 'PUBLISHED' ? post.simulated : !REAL_PUBLISH_PLATFORMS.has(post.platform)) && (
                          <span title="This platform isn't wired up for real publishing yet — this only updates status here, it doesn't post anywhere.">
                            <Badge tone="neutral">Simulated</Badge>
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-neutral-400">{post.contentItem.body || post.contentItem.type}</p>
                      <p className="mt-1 text-xs text-neutral-500">{new Date(post.scheduledTime).toLocaleString()}</p>
                      {post.status === 'FAILED' && post.errorMessage && (
                        <p className="mt-1 text-xs text-red-400">{post.errorMessage}</p>
                      )}
                    </div>
                    {post.status === 'PENDING' && (
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" onClick={() => onMarkPublished(post.id)}>
                          Publish Now
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setReschedulingId(reschedulingId === post.id ? null : post.id);
                            setRescheduleDateTime('');
                          }}
                        >
                          Reschedule
                        </Button>
                        <ConfirmButton onConfirm={() => onCancel(post.id)}>Cancel</ConfirmButton>
                      </div>
                    )}
                    {post.status === 'FAILED' && (
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {post.retryCount < MAX_RETRIES ? (
                          <Button size="sm" onClick={() => onRetry(post.id)}>
                            Retry{post.retryCount > 0 ? ` (${post.retryCount}/${MAX_RETRIES})` : ''}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setReschedulingId(reschedulingId === post.id ? null : post.id);
                              setRescheduleDateTime('');
                            }}
                          >
                            Reschedule
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {canReschedule && reschedulingId === post.id && (
                    <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
                      <input
                        type="datetime-local"
                        value={rescheduleDateTime}
                        onChange={(e) => setRescheduleDateTime(e.target.value)}
                        className="rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-xs text-neutral-50 outline-none focus:border-accent-400"
                      />
                      <Button
                        size="sm"
                        loading={rescheduling}
                        disabled={!rescheduleDateTime}
                        onClick={() => onReschedule(post.id)}
                      >
                        Confirm
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setReschedulingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </ul>
        )}
      </motion.div>
    </>
  );
}
