'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
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
import {
  Lightbulb,
  Users,
  Share2,
  FileText,
  Sparkles,
  ImageIcon,
  CalendarClock,
  CheckCircle2,
  Send,
  Zap,
  type LucideIcon,
} from 'lucide-react';

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

interface CampaignOption {
  id: string;
  name: string;
}

function PanelHeader({ n, title, icon: Icon, color }: { n: number; title: string; icon: LucideIcon; color: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-3">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {n}
      </span>
      <Icon className="h-4 w-4 shrink-0" style={{ color }} strokeWidth={2} />
      <h2 className="text-sm font-semibold text-neutral-50">{title}</h2>
    </div>
  );
}

export default function ContentPlannerPage() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();
  const searchParams = useSearchParams();
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
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [campaignId, setCampaignId] = useState<string>('');

  const [aiTopic, setAiTopic] = useState('');
  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [captionVariants, setCaptionVariants] = useState<CaptionVariant[] | null>(null);

  const [aiImagePrompt, setAiImagePrompt] = useState('');
  const [generatingImage, setGeneratingImage] = useState(false);

  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const [mode, setMode] = useState<'SEQUENTIAL' | 'PARALLEL'>('SEQUENTIAL');
  const [approvalDueDate, setApprovalDueDate] = useState('');

  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [publishingNowId, setPublishingNowId] = useState<string | null>(null);

  // Deep-linked from AI Image Studio's "Add to Content Planner" — ?client=<id>&media=<id> lands
  // here with both already selected instead of the user having to hunt the image down again.
  useEffect(() => {
    const clientParam = searchParams.get('client');
    const mediaParam = searchParams.get('media');
    if (clientParam) setSelectedClientId(clientParam);
    if (mediaParam) setMediaAssetId(mediaParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    api
      .get<CampaignOption[]>(`/clients/${selectedClientId}/campaigns`)
      .then(setCampaigns)
      .catch(() => setCampaigns([]));
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
        campaignId: campaignId || undefined,
      });
      setBody('');
      setHashtags('');
      setMentions('');
      setPlatforms([]);
      setMediaAssetId('');
      setCampaignId('');
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
        dueDate: approvalDueDate ? new Date(approvalDueDate).toISOString() : undefined,
      });
      setSubmittingId(null);
      setApproverIds([]);
      setApprovalDueDate('');
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

  // True one-click "promote now": creates the schedule for the current moment, then immediately
  // triggers the real publish call per platform rather than waiting for the once-a-minute
  // auto-publish cron to notice it (real delivery today only for Instagram — every other
  // platform still simulates the "Published" status underneath this same call).
  async function onPublishNow(item: ContentItem) {
    if (!selectedClientId) return;
    setPublishingNowId(item.id);
    setError(null);
    try {
      const posts = await api.post<{ id: string }[]>(`/clients/${selectedClientId}/content/${item.id}/schedule`, {
        scheduledTime: new Date().toISOString(),
        platforms: item.platforms.length ? item.platforms : undefined,
      });
      await Promise.all(posts.map((p) => api.post(`/scheduled-posts/${p.id}/publish`, {})));
      loadItems(selectedClientId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to publish now');
    } finally {
      setPublishingNowId(null);
    }
  }

  const drafts = items?.filter((i) => i.status === 'DRAFT' || i.status === 'CHANGES_REQUESTED') ?? [];
  const pendingApproval = items?.filter((i) => i.status === 'IN_REVIEW') ?? [];
  const approved = items?.filter((i) => i.status === 'APPROVED') ?? [];
  const scheduled = items?.filter((i) => i.status === 'SCHEDULED') ?? [];
  const published = items?.filter((i) => i.status === 'PUBLISHED') ?? [];
  const rejected = items?.filter((i) => i.status === 'REJECTED') ?? [];

  const counts = [
    { label: 'Drafts', value: drafts.length },
    { label: 'Pending Approval', value: pendingApproval.length },
    { label: 'Approved', value: approved.length },
    { label: 'Scheduled', value: scheduled.length },
    { label: 'Published', value: published.length },
    { label: 'Rejected', value: rejected.length },
  ];

  return (
    <motion.div variants={staggerContainer(0.06)} initial="hidden" animate="show" className="max-w-[1500px] space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Content Planner</h1>
        <p className="text-sm text-neutral-400">
          Create content with AI, pick platforms, get it approved, and publish — end to end.
        </p>
        <p className="mt-1 text-xs text-amber-300/80">
          AI video isn&apos;t connected yet (only AI images) — no video-generation model is set
          up. Real one-click publishing works for Instagram today; every other platform still
          simulates the &quot;Published&quot; status.
        </p>
      </motion.div>

      {clients && clients.length === 0 ? (
        <Card padding="lg">
          <p className="text-sm text-neutral-400">No clients yet — create one from Agency &amp; Clients first.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {error && (
              <p className="col-span-full rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
                {error}
              </p>
            )}

            {/* 1. Create New Content */}
            <Card padding="lg">
              <PanelHeader n={1} title="Create New Content" icon={Lightbulb} color="#f59e0b" />
              <p className="text-xs text-neutral-400">
                Fill in the panels below — client, platforms, details, AI captions, media — then
                save as a draft or send it straight for approval.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                {counts.map((c) => (
                  <div key={c.label} className="rounded-lg border border-white/10 bg-white/[0.03] py-2">
                    <p className="text-lg font-semibold text-neutral-100">{c.value}</p>
                    <p className="text-neutral-500">{c.label}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* 2. Select Client */}
            <Card padding="lg">
              <PanelHeader n={2} title="Select Client" icon={Users} color="#6366f1" />
              {clients && <ClientPicker clients={clients} value={selectedClientId} onChange={setSelectedClientId} />}
            </Card>

            {/* 3. Select Platforms */}
            <Card padding="lg">
              <PanelHeader n={3} title="Select Platforms" icon={Share2} color="#0ea5e9" />
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
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
            </Card>

            {/* 4. Content Details */}
            <Card padding="lg">
              <PanelHeader n={4} title="Content Details" icon={FileText} color="#f43f5e" />
              <div className="space-y-2">
                <Select value={type} onChange={(e) => setType(e.target.value as (typeof CONTENT_TYPES)[number])}>
                  {CONTENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
                <textarea
                  placeholder="Content / caption"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
                />
                <Input placeholder="Hashtags" value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
                <Input placeholder="Mentions" value={mentions} onChange={(e) => setMentions(e.target.value)} />
                <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                  <option value="">No campaign</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            </Card>

            {/* 5. AI Captions */}
            <Card padding="lg">
              <PanelHeader n={5} title="AI Captions" icon={Sparkles} color="#d946ef" />
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
                  disabled={!aiTopic.trim() || !selectedClientId}
                  onClick={onGenerateCaptions}
                >
                  Generate
                </Button>
              </div>
              {captionVariants && (
                <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                  {captionVariants.map((v, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => useCaptionVariant(v)}
                        className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-left text-[11px] text-neutral-300 hover:border-accent-400/40 hover:bg-accent-500/10"
                      >
                        {v.text}
                        {v.hashtags.length > 0 && <span className="mt-1 block text-accent-300">{v.hashtags.join(' ')}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* 6. Add Media */}
            <Card padding="lg">
              <PanelHeader n={6} title="Add Media" icon={ImageIcon} color="#8b5cf6" />
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Describe an AI image…"
                      value={aiImagePrompt}
                      onChange={(e) => setAiImagePrompt(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={generatingImage}
                    disabled={!aiImagePrompt.trim() || !selectedClientId}
                    onClick={onGenerateImage}
                  >
                    Generate
                  </Button>
                </div>
                <Select value={mediaAssetId} onChange={(e) => setMediaAssetId(e.target.value)}>
                  <option value="">No media</option>
                  {mediaAssets.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fileName}
                    </option>
                  ))}
                </Select>
                {mediaAssets.length === 0 && (
                  <p className="text-[11px] text-neutral-500">
                    Required for Instagram — upload in Media Library or generate one above.
                  </p>
                )}
              </div>
            </Card>

            {/* 7. Set Date & Time */}
            <Card padding="lg">
              <PanelHeader n={7} title="Set Date & Time" icon={CalendarClock} color="#22c55e" />
              {approved.length === 0 ? (
                <p className="text-xs text-neutral-500">
                  Nothing approved yet — approved content shows here ready to schedule.
                </p>
              ) : (
                <div className="max-h-52 space-y-2 overflow-y-auto">
                  {approved.map((item) => (
                    <div key={item.id} className="rounded-lg border border-white/10 px-2.5 py-2 text-[11px]">
                      <p className="truncate text-neutral-300">{item.body || item.type}</p>
                      {schedulingId === item.id ? (
                        <div className="mt-1.5 flex items-end gap-1.5">
                          <input
                            type="datetime-local"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            className="flex-1 rounded-lg border border-white/12 bg-white/[0.04] px-2 py-1 text-[11px] text-neutral-50 outline-none focus:border-accent-400"
                          />
                          <Button size="sm" loading={scheduling} disabled={!scheduleTime} onClick={() => onSchedule(item)}>
                            Go
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-1.5 flex gap-1.5">
                          <Button size="sm" variant="secondary" onClick={() => setSchedulingId(item.id)}>
                            Schedule
                          </Button>
                          <Button
                            size="sm"
                            loading={publishingNowId === item.id}
                            onClick={() => onPublishNow(item)}
                          >
                            <Zap className="h-3 w-3" /> Publish Now
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* 8. Review & Save */}
            <Card padding="lg">
              <PanelHeader n={8} title="Review & Save" icon={CheckCircle2} color="#f97316" />
              <form onSubmit={onCreate} className="space-y-2">
                <p className="text-[11px] text-neutral-500">
                  Uses the client, platforms, details, and media from the panels above.
                </p>
                <Button type="submit" size="sm" className="w-full" loading={creating} disabled={!selectedClientId}>
                  Save as Draft
                </Button>
              </form>
              {drafts.length > 0 && (
                <div className="mt-3 max-h-40 space-y-2 overflow-y-auto border-t border-white/10 pt-3">
                  {drafts.map((item) => (
                    <div key={item.id} className="rounded-lg border border-white/10 px-2.5 py-2 text-[11px]">
                      <p className="truncate text-neutral-300">{item.body || item.type}</p>
                      {submittingId === item.id ? (
                        <div className="mt-1.5 space-y-1.5">
                          <div className="flex flex-wrap gap-1">
                            {members.map((m) => (
                              <button
                                key={m.id}
                                onClick={() => toggleApprover(m.id)}
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                  approverIds.includes(m.id)
                                    ? 'border-accent-400/40 bg-accent-500/15 text-accent-200'
                                    : 'border-white/12 bg-white/[0.03] text-neutral-400'
                                }`}
                              >
                                {m.name}
                              </button>
                            ))}
                          </div>
                          <input
                            type="date"
                            value={approvalDueDate}
                            onChange={(e) => setApprovalDueDate(e.target.value)}
                            placeholder="Due date (optional)"
                            className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-2 py-1 text-[11px] text-neutral-50 outline-none focus:border-accent-400"
                          />
                          <Button size="sm" disabled={approverIds.length === 0} onClick={() => onSubmitForApproval(item.id)}>
                            Confirm
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="mt-1.5"
                          onClick={() => setSubmittingId(item.id)}
                        >
                          Send for Approval
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* 9. Approval / Schedule */}
            <Card padding="lg">
              <PanelHeader n={9} title="Approval & Schedule" icon={Send} color="#14b8a6" />
              <div className="space-y-2 text-[11px] text-neutral-400">
                <p>{pendingApproval.length} waiting on a reviewer.</p>
                <p>{scheduled.length} scheduled to publish automatically.</p>
                <p>{published.length} published so far.</p>
              </div>
              <div className="mt-3 flex flex-col gap-1.5 border-t border-white/10 pt-3 text-xs">
                <Link href="/approvals" className="font-medium text-accent-300 hover:underline">
                  Open Approvals →
                </Link>
                <Link href="/scheduler" className="font-medium text-accent-300 hover:underline">
                  Open Scheduler →
                </Link>
              </div>
            </Card>
          </div>

          {/* Right rail — status overview + quick actions */}
          <div className="space-y-4">
            <Card padding="lg">
              <h2 className="mb-3 text-sm font-semibold text-neutral-50">Content Status Overview</h2>
              <ul className="space-y-1.5 text-xs">
                {counts.map((c) => (
                  <li key={c.label} className="flex items-center justify-between text-neutral-400">
                    <span>{c.label}</span>
                    <span className="font-medium text-neutral-100">{c.value}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-xs font-semibold text-neutral-100">
                <span>Total Content</span>
                <span>{items?.length ?? 0}</span>
              </div>
            </Card>

            <Card padding="lg">
              <h2 className="mb-3 text-sm font-semibold text-neutral-50">Quick Actions</h2>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link href="/approvals" className="font-medium text-accent-300 hover:underline">
                    Content Approval Queue →
                  </Link>
                </li>
                <li>
                  <Link href="/scheduler" className="font-medium text-accent-300 hover:underline">
                    View Content Calendar →
                  </Link>
                </li>
                <li>
                  <Link href="/reports" className="font-medium text-accent-300 hover:underline">
                    Content Performance Report →
                  </Link>
                </li>
                <li>
                  <Link href="/admin/audit-log" className="font-medium text-accent-300 hover:underline">
                    Content Activity Log →
                  </Link>
                </li>
              </ul>
            </Card>

            {items === null && (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
