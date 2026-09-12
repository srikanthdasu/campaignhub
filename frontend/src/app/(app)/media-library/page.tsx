'use client';

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Upload,
  FileText,
  Music,
  Tag,
  Info,
  FolderInput,
  Send,
  Share2,
  BarChart3,
  Trash2,
  Copy,
  Check,
  X,
  type LucideIcon,
} from 'lucide-react';
import { api, ApiError, resolveMediaUrl } from '@/lib/api';
import { useClientPicker } from '@/hooks/use-client-picker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

const TYPE_LABELS: Record<string, string> = {
  IMAGE: 'Images',
  VIDEO: 'Videos',
  GIF: 'GIFs',
  AUDIO: 'Audio',
  DOCUMENT: 'Documents',
};

interface Campaign {
  id: string;
  name: string;
}

interface MediaAsset {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'GIF' | 'AUDIO' | 'DOCUMENT';
  storageUrl: string;
  fileName: string;
  title: string | null;
  description: string | null;
  fileSize: number | null;
  folder: string | null;
  tags: string[];
  campaignId: string | null;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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

export default function MediaLibraryPage() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();
  const [assets, setAssets] = useState<MediaAsset[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadFolder, setUploadFolder] = useState('');
  const [uploadCampaignId, setUploadCampaignId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [tagsDraft, setTagsDraft] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const [orgFolder, setOrgFolder] = useState('');
  const [orgCampaignId, setOrgCampaignId] = useState('');
  const [saving, setSaving] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  function loadAssets(clientId: string) {
    api.get<MediaAsset[]>(`/clients/${clientId}/media`).then(setAssets).catch(() => setAssets([]));
  }

  useEffect(() => {
    if (!selectedClientId) return;
    loadAssets(selectedClientId);
    api
      .get<Campaign[]>(`/clients/${selectedClientId}/campaigns`)
      .then(setCampaigns)
      .catch(() => setCampaigns([]));
    setActiveId(null);
    setSelectedIds([]);
  }, [selectedClientId]);

  const active = assets?.find((a) => a.id === activeId) ?? null;

  useEffect(() => {
    if (!active) return;
    setTagsDraft(active.tags);
    setTitleDraft(active.title ?? '');
    setDescDraft(active.description ?? '');
    setOrgFolder(active.folder ?? '');
    setOrgCampaignId(active.campaignId ?? '');
  }, [active]);

  async function onUpload(file: File) {
    if (!selectedClientId) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      if (uploadFolder.trim()) form.append('folder', uploadFolder.trim());
      if (uploadCampaignId) form.append('campaignId', uploadCampaignId);
      const asset = await api.upload<MediaAsset>(`/clients/${selectedClientId}/media`, form);
      setAssets((prev) => (prev ? [asset, ...prev] : [asset]));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function onFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onUpload(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onUpload(file);
  }

  async function onDelete(id: string) {
    if (!selectedClientId) return;
    try {
      await api.delete(`/clients/${selectedClientId}/media/${id}`);
      setAssets((prev) => prev?.filter((a) => a.id !== id) ?? null);
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      if (activeId === id) setActiveId(null);
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete asset');
    }
  }

  async function onBulkDelete() {
    if (!selectedClientId || selectedIds.length === 0) return;
    setBulkDeleting(true);
    setError(null);
    try {
      await api.post(`/clients/${selectedClientId}/media/bulk-delete`, { ids: selectedIds });
      setAssets((prev) => prev?.filter((a) => !selectedIds.includes(a.id)) ?? null);
      if (activeId && selectedIds.includes(activeId)) setActiveId(null);
      setSelectedIds([]);
      setConfirmBulkDelete(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete selected assets');
    } finally {
      setBulkDeleting(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function addTag() {
    const t = newTag.trim();
    if (!t || tagsDraft.includes(t)) return;
    setTagsDraft((prev) => [...prev, t]);
    setNewTag('');
  }

  async function saveField(data: Record<string, unknown>) {
    if (!selectedClientId || !activeId) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.patch<MediaAsset>(`/clients/${selectedClientId}/media/${activeId}`, data);
      setAssets((prev) => prev?.map((a) => (a.id === activeId ? updated : a)) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  function copyLink() {
    if (!active) return;
    navigator.clipboard
      ?.writeText(resolveMediaUrl(active.storageUrl))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setError('Could not copy — your browser blocked clipboard access.'));
  }

  const disabled = !active;
  const counts = assets?.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] ?? 0) + 1;
    return acc;
  }, {});
  const totalBytes = assets?.reduce((sum, a) => sum + (a.fileSize ?? 0), 0) ?? 0;
  const recent = [...(assets ?? [])].slice(0, 5);
  const usePublishHref = (path: string) =>
    active && selectedClientId ? `${path}?client=${selectedClientId}&media=${active.id}` : path;

  return (
    <motion.div variants={staggerContainer(0.06)} initial="hidden" animate="show" className="max-w-[1500px] space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Media Library</h1>
        <p className="text-sm text-neutral-400">From upload to organize, reuse, and share.</p>
        <p className="mt-1 text-xs text-amber-300/80">
          Everything below is real: upload, tags, folders, campaign links, title/description,
          share links, and usage tracking. Not built yet: per-asset permissions/access control,
          duplicate detection, version history, cloud drive imports, and auto-compression — these
          would each be a substantial feature on their own.
        </p>
      </motion.div>

      {clients && clients.length === 0 ? (
        <Card padding="lg">
          <p className="text-sm text-neutral-400">No clients yet — create one from Agency &amp; Clients first.</p>
        </Card>
      ) : (
        <>
          {clients && (
            <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }} className="max-w-xs">
              <Select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </motion.div>
          )}

          {error && (
            <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">{error}</p>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* 1. Upload Media */}
              <Card padding="lg">
                <PanelHeader n={1} title="Upload Media" icon={Upload} color="#8b5cf6" />
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex h-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center text-xs ${
                    dragOver ? 'border-accent-400 bg-accent-500/10' : 'border-white/15 text-neutral-500'
                  }`}
                >
                  <Upload className="mb-1 h-5 w-5" />
                  {uploading ? 'Uploading…' : 'Drag & drop or click to browse'}
                </div>
                <input ref={fileInputRef} type="file" className="hidden" onChange={onFileSelected} disabled={uploading} />
                <div className="mt-2 space-y-1.5">
                  <Input placeholder="Folder (optional)" value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value)} />
                  <Select value={uploadCampaignId} onChange={(e) => setUploadCampaignId(e.target.value)}>
                    <option value="">No campaign</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <p className="mt-2 text-[10px] text-neutral-500">Images, video, GIF, audio, PDF/DOC/PPT.</p>
              </Card>

              {/* 2. Categorize */}
              <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
                <PanelHeader n={2} title="Categorize" icon={Tag} color="#0ea5e9" />
                {disabled ? (
                  <p className="text-xs text-neutral-500">Select an asset from the library below.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {tagsDraft.map((t) => (
                        <span key={t} className="flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[11px] text-neutral-300">
                          #{t}
                          <button onClick={() => setTagsDraft((prev) => prev.filter((x) => x !== t))}>×</button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <div className="flex-1">
                        <Input
                          placeholder="Add a tag…"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        />
                      </div>
                      <Button size="sm" variant="secondary" onClick={addTag}>
                        Add
                      </Button>
                    </div>
                    <Button size="sm" className="w-full" loading={saving} onClick={() => saveField({ tags: tagsDraft })}>
                      Save Tags
                    </Button>
                  </div>
                )}
              </Card>

              {/* 3. Preview & Info */}
              <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
                <PanelHeader n={3} title="Preview & Info" icon={Info} color="#f59e0b" />
                {disabled ? (
                  <p className="text-xs text-neutral-500">Select an asset from the library below.</p>
                ) : (
                  <div className="space-y-1.5">
                    <div className="h-20 overflow-hidden rounded-lg bg-white/[0.03]">
                      {active.type === 'IMAGE' || active.type === 'GIF' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={resolveMediaUrl(active.storageUrl)} alt={active.title || active.fileName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-neutral-500">{active.type}</div>
                      )}
                    </div>
                    <Input placeholder="Title" value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} />
                    <Textarea
                      placeholder="Description"
                      value={descDraft}
                      onChange={(e) => setDescDraft(e.target.value)}
                      rows={2}
                    />
                    <Button
                      size="sm"
                      className="w-full"
                      loading={saving}
                      onClick={() => saveField({ title: titleDraft, description: descDraft })}
                    >
                      Save Info
                    </Button>
                  </div>
                )}
              </Card>

              {/* 4. Organize */}
              <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
                <PanelHeader n={4} title="Organize" icon={FolderInput} color="#22c55e" />
                {disabled ? (
                  <p className="text-xs text-neutral-500">Select an asset from the library below.</p>
                ) : (
                  <div className="space-y-2">
                    <Input placeholder="Move to folder…" value={orgFolder} onChange={(e) => setOrgFolder(e.target.value)} />
                    <Select value={orgCampaignId} onChange={(e) => setOrgCampaignId(e.target.value)}>
                      <option value="">No campaign</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                    <p className="text-[10px] text-neutral-500">
                      Per-asset permissions/access control aren&apos;t built yet.
                    </p>
                    <Button
                      size="sm"
                      className="w-full"
                      loading={saving}
                      onClick={() => saveField({ folder: orgFolder || undefined, campaignId: orgCampaignId || null })}
                    >
                      Save
                    </Button>
                  </div>
                )}
              </Card>

              {/* 5. Use in Content */}
              <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
                <PanelHeader n={5} title="Use in Content" icon={Send} color="#d946ef" />
                {disabled ? (
                  <p className="text-xs text-neutral-500">Select an asset from the library below.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-neutral-400">Used {active.usageCount} time{active.usageCount === 1 ? '' : 's'} so far.</p>
                    <Link
                      href={usePublishHref('/content-planner')}
                      className="block rounded-lg border border-accent-400/40 bg-accent-500/15 px-3 py-1.5 text-center text-xs font-medium text-accent-200 hover:bg-accent-500/25"
                    >
                      Use in Content Planner →
                    </Link>
                    <Link
                      href={usePublishHref('/scheduler')}
                      className="block rounded-lg border border-accent-400/40 bg-accent-500/15 px-3 py-1.5 text-center text-xs font-medium text-accent-200 hover:bg-accent-500/25"
                    >
                      Use in Scheduler →
                    </Link>
                  </div>
                )}
              </Card>

              {/* 6. Share / Download */}
              <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
                <PanelHeader n={6} title="Share / Download" icon={Share2} color="#14b8a6" />
                {disabled ? (
                  <p className="text-xs text-neutral-500">Select an asset from the library below.</p>
                ) : (
                  <div className="space-y-2">
                    <Button size="sm" variant="secondary" className="w-full" onClick={copyLink}>
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied!' : 'Copy Link'}
                    </Button>
                    <a
                      href={resolveMediaUrl(active.storageUrl)}
                      download
                      className="block rounded-lg border border-white/12 px-3 py-1.5 text-center text-xs font-medium text-neutral-300 hover:border-white/20"
                    >
                      Download{active.fileSize ? ` (${formatBytes(active.fileSize)})` : ''}
                    </a>
                    <p className="text-[10px] text-neutral-500">Link expiry and view-only sharing controls aren&apos;t built yet.</p>
                  </div>
                )}
              </Card>

              {/* 7. Track Usage */}
              <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
                <PanelHeader n={7} title="Track Usage" icon={BarChart3} color="#eab308" />
                {disabled ? (
                  <p className="text-xs text-neutral-500">Select an asset from the library below.</p>
                ) : (
                  <div className="space-y-1.5 text-xs text-neutral-400">
                    <p>
                      Total usage: <span className="font-semibold text-neutral-100">{active.usageCount}</span>
                    </p>
                    <p>Last used: {active.lastUsedAt ? new Date(active.lastUsedAt).toLocaleString() : 'Never'}</p>
                    <p>Added: {new Date(active.createdAt).toLocaleDateString()}</p>
                    {active.fileSize && <p>Size: {formatBytes(active.fileSize)}</p>}
                  </div>
                )}
              </Card>
            </div>

            {/* Right rail */}
            <div className="space-y-4">
              <Card padding="lg">
                <h2 className="mb-3 text-sm font-semibold text-neutral-50">Media Overview</h2>
                <ul className="space-y-1.5 text-xs">
                  {Object.entries(TYPE_LABELS).map(([type, label]) => (
                    <li key={type} className="flex items-center justify-between text-neutral-400">
                      <span>{label}</span>
                      <span className="font-medium text-neutral-100">{counts?.[type] ?? 0}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-xs font-semibold text-neutral-100">
                  <span>Total Files</span>
                  <span>{assets?.length ?? 0}</span>
                </div>
                <p className="mt-1 text-[11px] text-neutral-500">Storage used: {formatBytes(totalBytes)}</p>
              </Card>

              <Card padding="lg">
                <h2 className="mb-3 text-sm font-semibold text-neutral-50">Quick Actions</h2>
                <ul className="space-y-2 text-xs">
                  <li>
                    <button onClick={() => fileInputRef.current?.click()} className="font-medium text-accent-300 hover:underline">
                      Upload Media →
                    </button>
                  </li>
                  <li>
                    <Link href="/ai-image-studio" className="font-medium text-accent-300 hover:underline">
                      Generate AI Image →
                    </Link>
                  </li>
                  {selectedIds.length > 0 && (
                    <li>
                      {confirmBulkDelete ? (
                        <span className="flex items-center gap-2">
                          <button
                            onClick={onBulkDelete}
                            disabled={bulkDeleting}
                            className="font-semibold text-red-400 hover:underline"
                          >
                            {bulkDeleting ? 'Deleting…' : `Confirm delete ${selectedIds.length}`}
                          </button>
                          <button
                            onClick={() => setConfirmBulkDelete(false)}
                            disabled={bulkDeleting}
                            className="text-neutral-400 hover:underline"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                      <button
                        onClick={() => setConfirmBulkDelete(true)}
                        className="flex items-center gap-1 font-medium text-red-400 hover:underline"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {`Delete ${selectedIds.length} Selected`}
                      </button>
                      )}
                    </li>
                  )}
                </ul>
              </Card>

              <Card padding="lg">
                <h2 className="mb-3 text-sm font-semibold text-neutral-50">Recently Added</h2>
                {recent.length === 0 ? (
                  <p className="text-xs text-neutral-500">Nothing uploaded yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {recent.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 text-xs">
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-white/[0.03]">
                          {a.type === 'IMAGE' || a.type === 'GIF' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={resolveMediaUrl(a.storageUrl)} alt={a.title || a.fileName} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <span className="truncate text-neutral-300">{a.title || a.fileName}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          {/* Library grid */}
          <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
            <h2 className="mb-3 text-sm font-semibold text-neutral-50">All Media</h2>
            {assets === null ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-2xl" />
                ))}
              </div>
            ) : assets.length === 0 ? (
              <Card padding="lg">
                <p className="text-sm text-neutral-400">No media uploaded yet.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                <AnimatePresence initial={false}>
                  {assets.map((asset) => (
                    <motion.div
                      key={asset.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: DURATION.base, ease: EASE_SOFT }}
                    >
                      <Card
                        padding="none"
                        hoverable
                        onClick={() => setActiveId(asset.id)}
                        className={`group cursor-pointer overflow-hidden ${activeId === asset.id ? 'ring-2 ring-accent-400' : ''}`}
                      >
                        <div className="relative aspect-square bg-white/[0.03]">
                          {asset.type === 'IMAGE' || asset.type === 'GIF' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={resolveMediaUrl(asset.storageUrl)} alt={asset.fileName} className="h-full w-full object-cover" />
                          ) : asset.type === 'VIDEO' ? (
                            <video src={resolveMediaUrl(asset.storageUrl)} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              {asset.type === 'AUDIO' ? (
                                <Music className="h-8 w-8 text-neutral-500" />
                              ) : (
                                <FileText className="h-8 w-8 text-neutral-500" />
                              )}
                            </div>
                          )}
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(asset.id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleSelected(asset.id)}
                            className="absolute left-2 top-2 h-4 w-4 accent-accent-500"
                          />
                          {confirmDeleteId === asset.id ? (
                            <span className="absolute right-2 top-2 flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDelete(asset.id);
                                }}
                                title="Confirm delete"
                                aria-label={`Confirm delete ${asset.title || asset.fileName}`}
                                className="rounded-lg bg-red-500/90 p-1.5 backdrop-blur-sm"
                              >
                                <Check className="h-3.5 w-3.5 text-white" strokeWidth={2} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(null);
                                }}
                                title="Cancel"
                                aria-label="Cancel delete"
                                className="rounded-lg bg-black/60 p-1.5 backdrop-blur-sm"
                              >
                                <X className="h-3.5 w-3.5 text-white" strokeWidth={2} />
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(asset.id);
                              }}
                              title="Delete"
                              aria-label={`Delete ${asset.title || asset.fileName}`}
                              className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-white" strokeWidth={2} />
                            </button>
                          )}
                        </div>
                        <div className="p-2.5">
                          <p className="truncate text-xs font-medium text-neutral-200">{asset.title || asset.fileName}</p>
                          <p className="text-[11px] text-neutral-500">Used {asset.usageCount}×</p>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
