'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { useClientPicker } from '@/hooks/use-client-picker';
import { ClientPicker } from '@/components/client-picker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface MediaAssetOption {
  id: string;
  fileName: string;
  storageUrl: string;
}

interface CaptionVariant {
  text: string;
  hashtags: string[];
}

export default function ContentPlannerPage() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();
  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [type, setType] = useState<(typeof CONTENT_TYPES)[number]>('CAPTION');
  const [body, setBody] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [mentions, setMentions] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAssetOption[]>([]);
  const [mediaAssetId, setMediaAssetId] = useState<string>('');

  const [aiTopic, setAiTopic] = useState('');
  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [captionVariants, setCaptionVariants] = useState<CaptionVariant[] | null>(null);

  const [aiImagePrompt, setAiImagePrompt] = useState('');
  const [generatingImage, setGeneratingImage] = useState(false);

  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const [mode, setMode] = useState<'SEQUENTIAL' | 'PARALLEL'>('SEQUENTIAL');

  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduling, setScheduling] = useState(false);

  function loadItems(clientId: string) {
    api
      .get<ContentItem[]>(`/clients/${clientId}/content`)
      .then(setItems)
      .catch(() => setItems([]));
  }

  function loadMedia(clientId: string) {
    api
      .get<MediaAssetOption[]>(`/clients/${clientId}/media`)
      .then(setMediaAssets)
      .catch(() => setMediaAssets([]));
  }

  useEffect(() => {
    if (!selectedClientId) return;
    loadItems(selectedClientId);
    api
      .get<Member[]>(`/clients/${selectedClientId}/access`)
      .then(setMembers)
      .catch(() => setMembers([]));
    loadMedia(selectedClientId);
  }, [selectedClientId]);

  function togglePlatform(p: string) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function onGenerateCaptions() {
    if (!selectedClientId || !aiTopic.trim()) return;
    setError(null);
    setGeneratingCaptions(true);
    setCaptionVariants(null);
    try {
      const variants = await api.post<CaptionVariant[]>(`/clients/${selectedClientId}/ai-captions/generate`, {
        input: aiTopic,
        platform: platforms[0] || undefined,
      });
      setCaptionVariants(variants);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate captions');
    } finally {
      setGeneratingCaptions(false);
    }
  }

  function useCaptionVariant(variant: CaptionVariant) {
    setBody(variant.text);
    setHashtags(variant.hashtags.join(' '));
    setCaptionVariants(null);
  }

  async function onGenerateImage() {
    if (!selectedClientId || !aiImagePrompt.trim()) return;
    setError(null);
    setGeneratingImage(true);
    try {
      const asset = await api.post<MediaAssetOption>(`/clients/${selectedClientId}/media/generate-image`, {
        prompt: aiImagePrompt,
      });
      setMediaAssets((prev) => [asset, ...prev]);
      setMediaAssetId(asset.id);
      setAiImagePrompt('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate image');
    } finally {
      setGeneratingImage(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!selectedClientId) return;
    setError(null);
    setCreating(true);
    try {
      const fullBody = [body, hashtags, mentions].map((s) => s.trim()).filter(Boolean).join('\n\n');
      await api.post(`/clients/${selectedClientId}/content`, {
        type,
        body: fullBody,
        platforms,
        mediaAssetId: mediaAssetId || undefined,
      });
      setBody('');
      setHashtags('');
      setMentions('');
      setPlatforms([]);
      setMediaAssetId('');
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

  async function onSchedule(item: ContentItem) {
    if (!selectedClientId || !scheduleTime) return;
    setScheduling(true);
    setError(null);
    try {
      await api.post(`/clients/${selectedClientId}/content/${item.id}/schedule`, {
        scheduledTime: new Date(scheduleTime).toISOString(),
        platforms: item.platforms.length ? item.platforms : undefined,
      });
      setSchedulingId(null);
      setScheduleTime('');
      loadItems(selectedClientId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to schedule content');
    } finally {
      setScheduling(false);
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

                <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <label className="text-xs font-medium text-neutral-400">AI captions</label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="What's this post about?"
                        value={aiTopic}
                        onChange={(e) => setAiTopic(e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={generatingCaptions}
                      disabled={!aiTopic.trim()}
                      onClick={onGenerateCaptions}
                    >
                      Generate
                    </Button>
                  </div>
                  {captionVariants && (
                    <ul className="mt-2 space-y-2">
                      {captionVariants.map((v, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            onClick={() => useCaptionVariant(v)}
                            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs text-neutral-300 hover:border-accent-400/40 hover:bg-accent-500/10"
                          >
                            {v.text}
                            {v.hashtags.length > 0 && (
                              <span className="mt-1 block text-accent-300">{v.hashtags.join(' ')}</span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-neutral-300">Body / caption</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none transition-all duration-200 placeholder:text-neutral-500 hover:border-white/20 focus:border-accent-400 focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_rgba(91,99,245,0.18)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Hashtags"
                    placeholder="#summer #sale"
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                  />
                  <Input
                    label="Mentions"
                    placeholder="@partner"
                    value={mentions}
                    onChange={(e) => setMentions(e.target.value)}
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

                <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <label className="text-xs font-medium text-neutral-400">AI image</label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Describe an image to generate…"
                        value={aiImagePrompt}
                        onChange={(e) => setAiImagePrompt(e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={generatingImage}
                      disabled={!aiImagePrompt.trim()}
                      onClick={onGenerateImage}
                    >
                      Generate
                    </Button>
                  </div>
                </div>

                <Select
                  label="Media (optional — required for Instagram)"
                  value={mediaAssetId}
                  onChange={(e) => setMediaAssetId(e.target.value)}
                >
                  <option value="">No media</option>
                  {mediaAssets.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fileName}
                    </option>
                  ))}
                </Select>
                {mediaAssets.length === 0 && (
                  <p className="text-xs text-neutral-500">
                    No media uploaded for this client yet — upload one in Media Library, or generate one above.
                  </p>
                )}

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
                          {item.status === 'APPROVED' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                setSchedulingId(schedulingId === item.id ? null : item.id)
                              }
                            >
                              Schedule
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

                        <AnimatePresence>
                          {schedulingId === item.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="mt-4 overflow-hidden border-t border-white/10 pt-4"
                            >
                              <div className="flex items-end gap-3">
                                <div className="flex-1">
                                  <Input
                                    label="Date & time"
                                    type="datetime-local"
                                    value={scheduleTime}
                                    onChange={(e) => setScheduleTime(e.target.value)}
                                  />
                                </div>
                                <Button
                                  size="sm"
                                  loading={scheduling}
                                  disabled={!scheduleTime}
                                  onClick={() => onSchedule(item)}
                                >
                                  Confirm
                                </Button>
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
        </>
      )}
    </motion.div>
  );
}
