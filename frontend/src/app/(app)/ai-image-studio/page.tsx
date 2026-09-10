'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Trash2, Wand2, Users, LayoutGrid, MessageSquareText, Sparkles, Images, Send, type LucideIcon } from 'lucide-react';
import { api, ApiError, resolveMediaUrl } from '@/lib/api';
import { useClientPicker } from '@/hooks/use-client-picker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

const IMAGE_TYPES = [
  { key: 'SOCIAL', label: 'Social Media Post', promptPrefix: 'Square social media post: ', size: '1024x1024' },
  { key: 'BANNER', label: 'Banner / Cover', promptPrefix: 'Wide banner/cover image: ', size: '1792x1024' },
  { key: 'AD', label: 'Ad Creative', promptPrefix: 'Eye-catching ad creative: ', size: '1024x1024' },
  { key: 'PRODUCT', label: 'Product Image', promptPrefix: 'Clean professional product photography: ', size: '1024x1024' },
  { key: 'EVENT', label: 'Event / Festival', promptPrefix: 'Festive promotional graphic: ', size: '1024x1024' },
  { key: 'CUSTOM', label: 'Custom', promptPrefix: '', size: '1024x1024' },
] as const;

const STYLES = ['Modern & Vibrant', 'Minimal & Clean', 'Bold & Playful', 'Elegant & Muted'] as const;

const ASPECT_RATIOS = [
  { value: '1024x1024', label: 'Square (1:1)' },
  { value: '1024x1792', label: 'Portrait (Story/Reel)' },
  { value: '1792x1024', label: 'Landscape (Banner/Cover)' },
] as const;

const SUGGESTED_PROMPTS = [
  'Summer sale offer',
  'New product launch',
  'Festival wishes',
  'Customer testimonial',
  'Food promotion',
  'Real estate listing',
];

const BATCH_SIZE = 4;
const REAL_PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'X', 'TIKTOK', 'YOUTUBE', 'PINTEREST', 'WHATSAPP'];

interface Campaign {
  id: string;
  name: string;
}

interface MediaAsset {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'GIF' | 'AUDIO' | 'DOCUMENT';
  storageUrl: string;
  fileName: string;
  prompt: string | null;
  aiProvider: string | null;
  usageCount: number;
  createdAt: string;
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

export default function AiImageStudioPage() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState('');

  const [imageType, setImageType] = useState<(typeof IMAGE_TYPES)[number]['key']>('SOCIAL');
  const [style, setStyle] = useState<(typeof STYLES)[number]>('Modern & Vibrant');
  const [aspectRatio, setAspectRatio] = useState<string>('1024x1024');
  const [prompt, setPrompt] = useState('');

  const [generating, setGenerating] = useState(false);
  const [batch, setBatch] = useState<MediaAsset[] | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [gallery, setGallery] = useState<MediaAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadGallery(clientId: string) {
    api
      .get<MediaAsset[]>(`/clients/${clientId}/media`)
      .then((all) => setGallery(all.filter((a) => a.prompt)))
      .catch(() => setGallery([]));
  }

  useEffect(() => {
    if (!selectedClientId) return;
    loadGallery(selectedClientId);
    api
      .get<Campaign[]>(`/clients/${selectedClientId}/campaigns`)
      .then(setCampaigns)
      .catch(() => setCampaigns([]));
    setBatch(null);
    setSelectedBatchId(null);
    setCampaignId('');
  }, [selectedClientId]);

  function onPickImageType(key: (typeof IMAGE_TYPES)[number]['key']) {
    setImageType(key);
    const preset = IMAGE_TYPES.find((t) => t.key === key);
    if (preset) setAspectRatio(preset.size);
  }

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    if (!selectedClientId || !prompt.trim()) return;
    setError(null);
    setGenerating(true);
    setBatch(null);
    setSelectedBatchId(null);
    try {
      const preset = IMAGE_TYPES.find((t) => t.key === imageType)!;
      const fullPrompt = `${preset.promptPrefix}${prompt.trim()}, ${style.toLowerCase()} style`;
      const folder = campaigns.find((c) => c.id === campaignId)?.name;
      const results = await Promise.allSettled(
        Array.from({ length: BATCH_SIZE }, () =>
          api.post<MediaAsset>(`/clients/${selectedClientId}/media/generate-image`, {
            prompt: fullPrompt,
            size: aspectRatio,
            folder,
            campaignId: campaignId || undefined,
          }),
        ),
      );
      const succeeded = results
        .filter((r): r is PromiseFulfilledResult<MediaAsset> => r.status === 'fulfilled')
        .map((r) => r.value);
      const failedCount = results.length - succeeded.length;
      if (succeeded.length === 0) {
        setError('Failed to generate images — try again.');
      } else {
        setBatch(succeeded);
        setSelectedBatchId(succeeded[0].id);
        setGallery((prev) => (prev ? [...succeeded, ...prev] : succeeded));
        if (failedCount > 0) {
          setError(`${succeeded.length} of ${BATCH_SIZE} images generated — ${failedCount} failed, try regenerating if you need more.`);
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate images');
    } finally {
      setGenerating(false);
    }
  }

  async function onDelete(id: string) {
    if (!selectedClientId) return;
    try {
      await api.delete(`/clients/${selectedClientId}/media/${id}`);
      setGallery((prev) => prev?.filter((a) => a.id !== id) ?? null);
      setBatch((prev) => prev?.filter((a) => a.id !== id) ?? null);
      if (selectedBatchId === id) setSelectedBatchId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete image');
    }
  }

  const disabled = !selectedClientId;
  const selectedAsset = [...(batch ?? []), ...(gallery ?? [])].find((a) => a.id === selectedBatchId) ?? null;
  const usePublishHref = (path: string) =>
    selectedAsset && selectedClientId
      ? `${path}?client=${selectedClientId}&media=${selectedAsset.id}`
      : undefined;

  return (
    <motion.div variants={staggerContainer(0.06)} initial="hidden" animate="show" className="max-w-[1500px] space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">AI Image Studio</h1>
        <p className="text-sm text-neutral-400">Turn your ideas into real, usable visuals with AI.</p>
        <p className="mt-1 text-xs text-amber-300/80">
          Everything below is real: image type, style, and aspect ratio genuinely change what
          gets generated, and every image is really saved to the client&apos;s Media Library.
          What isn&apos;t built yet: in-browser editing (adding text/logo overlays, background
          removal, filters, cropping) — that&apos;s a much larger feature on its own. Let me know
          if you want that built next.
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

            {/* 1. Select Client & Campaign */}
            <Card padding="lg">
              <PanelHeader n={1} title="Client & Campaign" icon={Users} color="#6366f1" />
              <div className="space-y-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-neutral-400">Client</label>
                  <Select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
                    {(clients ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-neutral-400">Campaign (optional)</label>
                  <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} disabled={disabled}>
                    <option value="">No campaign</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </Card>

            {/* 2. Choose Image Type & Style */}
            <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
              <PanelHeader n={2} title="Image Type & Style" icon={LayoutGrid} color="#0ea5e9" />
              {disabled ? (
                <p className="text-xs text-neutral-500">Select a client first.</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {IMAGE_TYPES.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => onPickImageType(t.key)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                          imageType === t.key
                            ? 'border-accent-400/40 bg-accent-500/15 text-accent-200'
                            : 'border-white/12 bg-white/[0.03] text-neutral-400'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <Select value={style} onChange={(e) => setStyle(e.target.value as (typeof STYLES)[number])}>
                    {STYLES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                  <Select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
                    {ASPECT_RATIOS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </Card>

            {/* 3. Enter Prompt */}
            <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
              <PanelHeader n={3} title="Enter Prompt" icon={MessageSquareText} color="#f59e0b" />
              {disabled ? (
                <p className="text-xs text-neutral-500">Select a client first.</p>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe what you want — e.g. bright colors, sunglasses, beach background, discount text"
                    rows={3}
                    className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
                  />
                  <div className="flex flex-wrap gap-1">
                    {SUGGESTED_PROMPTS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPrompt(p)}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-neutral-400 hover:text-neutral-200"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* 4. Generate Images */}
            <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
              <PanelHeader n={4} title="Generate Images" icon={Wand2} color="#d946ef" />
              {disabled ? (
                <p className="text-xs text-neutral-500">Select a client first.</p>
              ) : (
                <form onSubmit={onGenerate} className="space-y-2">
                  <p className="text-[11px] text-neutral-500">
                    Generates {BATCH_SIZE} real variations using the panels above — takes a few
                    seconds each.
                  </p>
                  <Button type="submit" size="sm" className="w-full" loading={generating} disabled={!prompt.trim()}>
                    <Wand2 className="h-3.5 w-3.5" /> Generate {BATCH_SIZE} Images
                  </Button>
                </form>
              )}
            </Card>

            {/* 5. Generated Images */}
            <Card padding="lg" className="sm:col-span-2">
              <PanelHeader n={5} title="Generated Images" icon={Images} color="#22c55e" />
              {generating ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {Array.from({ length: BATCH_SIZE }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-xl" />
                  ))}
                </div>
              ) : !batch || batch.length === 0 ? (
                <p className="text-xs text-neutral-500">Generate a batch to see results here.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {batch.map((asset) => (
                    <button
                      key={asset.id}
                      onClick={() => setSelectedBatchId(asset.id)}
                      className={`overflow-hidden rounded-xl border-2 ${
                        selectedBatchId === asset.id ? 'border-accent-400' : 'border-transparent'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resolveMediaUrl(asset.storageUrl)} alt="" className="aspect-square w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* 6. Use & Publish */}
            <Card padding="lg" className="sm:col-span-2">
              <PanelHeader n={6} title="Use & Publish" icon={Send} color="#14b8a6" />
              {!selectedAsset ? (
                <p className="text-xs text-neutral-500">Pick an image above (or from history) first.</p>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resolveMediaUrl(selectedAsset.storageUrl)} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex flex-1 flex-wrap gap-2">
                    <a
                      href={resolveMediaUrl(selectedAsset.storageUrl)}
                      download
                      className="rounded-lg border border-white/12 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:border-white/20"
                    >
                      Download
                    </a>
                    <Link
                      href={usePublishHref('/content-planner') ?? '/content-planner'}
                      className="rounded-lg border border-accent-400/40 bg-accent-500/15 px-3 py-1.5 text-xs font-medium text-accent-200 hover:bg-accent-500/25"
                    >
                      Add to Content Planner →
                    </Link>
                    <Link
                      href={usePublishHref('/scheduler') ?? '/scheduler'}
                      className="rounded-lg border border-accent-400/40 bg-accent-500/15 px-3 py-1.5 text-xs font-medium text-accent-200 hover:bg-accent-500/25"
                    >
                      Schedule It →
                    </Link>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Right rail */}
          <div className="space-y-4">
            <Card padding="lg">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-50">
                <Sparkles className="h-4 w-4 text-accent-300" /> AI Image History
              </h2>
              {gallery === null ? (
                <Skeleton className="h-40 w-full" />
              ) : gallery.length === 0 ? (
                <p className="text-xs text-neutral-500">No AI images yet for this client.</p>
              ) : (
                <div className="grid max-h-96 grid-cols-2 gap-2 overflow-y-auto">
                  <AnimatePresence initial={false}>
                    {gallery.map((asset) => (
                      <motion.div
                        key={asset.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: DURATION.base, ease: EASE_SOFT }}
                      >
                        <button
                          onClick={() => setSelectedBatchId(asset.id)}
                          className={`group relative block aspect-square w-full overflow-hidden rounded-lg border-2 ${
                            selectedBatchId === asset.id ? 'border-accent-400' : 'border-transparent'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={resolveMediaUrl(asset.storageUrl)} alt="" className="h-full w-full object-cover" />
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(asset.id);
                            }}
                            className="absolute right-1 top-1 rounded bg-black/60 p-1 opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="h-3 w-3 text-white" />
                          </span>
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </Card>

            <Card padding="lg">
              <h2 className="mb-3 text-sm font-semibold text-neutral-50">Supported Platforms</h2>
              <div className="flex flex-wrap gap-1.5">
                {REAL_PLATFORMS.map((p) => (
                  <Badge key={p} tone="neutral">
                    {p}
                  </Badge>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </motion.div>
  );
}
