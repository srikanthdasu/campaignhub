'use client';

import { FormEvent, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { api, ApiError } from '@/lib/api';
import { useClientPicker } from '@/hooks/use-client-picker';
import { ClientPicker } from '@/components/client-picker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import { STOCK_CATALOG } from '@/lib/ai-video-stock';
import { Film, Image as ImageIcon, Music, Plus, Sparkles, Trash2 } from 'lucide-react';

const STEPS = [
  { key: 'IDEA', label: 'Idea / Input' },
  { key: 'SCRIPT', label: 'Script' },
  { key: 'STORYBOARD', label: 'Scene Builder' },
  { key: 'ASSETS', label: 'Media & Assets' },
  { key: 'ENHANCE', label: 'Edit & Enhance' },
  { key: 'PREVIEW', label: 'Preview' },
  { key: 'EXPORT', label: 'Export' },
  { key: 'PUBLISHED', label: 'Publish' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

interface Scene {
  title: string;
  description: string;
  durationSec: number;
}

interface Enhancements {
  autoCut?: boolean;
  smoothTransitions?: boolean;
  autoCaptions?: boolean;
  colorCorrection?: boolean;
  brandWatermark?: boolean;
  backgroundMusic?: string;
}

interface VideoProject {
  id: string;
  title: string;
  idea: string | null;
  script: string | null;
  scenes: Scene[] | null;
  assets: string[] | null;
  enhancements: Enhancements | null;
  step: StepKey;
  previewUrl: string | null;
  exportFormat: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

const ENHANCE_TOGGLES: { key: keyof Enhancements; label: string }[] = [
  { key: 'autoCut', label: 'Auto Cut' },
  { key: 'smoothTransitions', label: 'Smooth Transitions' },
  { key: 'autoCaptions', label: 'Auto Captions' },
  { key: 'colorCorrection', label: 'Color Correction' },
  { key: 'brandWatermark', label: 'Brand Watermark' },
];

export default function AiVideoStudioPage() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();

  return (
    <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">AI Video Studio</h1>
        <p className="text-sm text-neutral-400">From idea to ready-to-publish video.</p>
        <p className="mt-2 text-xs text-amber-300/80">
          No Google Cloud / Vertex AI (Veo) credentials are configured yet, so the stock library
          is a small fixed catalog and Preview/Export produce a placeholder clip instead of a
          real render. Script generation uses real AI.
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

          {selectedClientId && <VideoStudioWorkspace key={selectedClientId} clientId={selectedClientId} />}
        </>
      )}
    </motion.div>
  );
}

function VideoStudioWorkspace({ clientId }: { clientId: string }) {
  const [projects, setProjects] = useState<VideoProject[] | null>(null);
  const [active, setActive] = useState<VideoProject | null>(null);
  const [activeTab, setActiveTab] = useState<StepKey>('IDEA');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newIdea, setNewIdea] = useState('');
  const [scenesDraft, setScenesDraft] = useState<Scene[]>([]);
  const [assetsDraft, setAssetsDraft] = useState<Set<string>>(new Set());
  const [enhanceDraft, setEnhanceDraft] = useState<Enhancements>({});
  const [exportFormat, setExportFormat] = useState('MP4');

  function loadProjects() {
    api
      .get<VideoProject[]>(`/clients/${clientId}/ai-video-studio/projects`)
      .then(setProjects)
      .catch(() => setProjects([]));
  }

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stepIndex = (key: StepKey) => STEPS.findIndex((s) => s.key === key);
  const maxReachable = active ? stepIndex(active.step) + 1 : 0;

  function applyActive(project: VideoProject) {
    setActive(project);
    setActiveTab(project.step);
    setScenesDraft(project.scenes ?? []);
    setAssetsDraft(new Set(project.assets ?? []));
    setEnhanceDraft(project.enhancements ?? {});
    setExportFormat(project.exportFormat ?? 'MP4');
  }

  async function refreshActive(id: string) {
    const project = await api.get<VideoProject>(`/clients/${clientId}/ai-video-studio/projects/${id}`);
    applyActive(project);
    loadProjects();
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const project = await api.post<VideoProject>(`/clients/${clientId}/ai-video-studio/projects`, {
        title: newTitle,
        idea: newIdea,
      });
      setNewTitle('');
      setNewIdea('');
      await refreshActive(project.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create project');
    } finally {
      setBusy(false);
    }
  }

  async function onGenerateScript() {
    if (!active) return;
    setError(null);
    setBusy(true);
    try {
      await api.post(`/clients/${clientId}/ai-video-studio/projects/${active.id}/script`, {
        idea: active.idea || newIdea || active.title,
      });
      await refreshActive(active.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate script');
    } finally {
      setBusy(false);
    }
  }

  async function onSaveStoryboard() {
    if (!active) return;
    setBusy(true);
    try {
      await api.post(`/clients/${clientId}/ai-video-studio/projects/${active.id}/storyboard`, {
        scenes: scenesDraft,
      });
      await refreshActive(active.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save storyboard');
    } finally {
      setBusy(false);
    }
  }

  async function onSaveAssets() {
    if (!active) return;
    setBusy(true);
    try {
      await api.post(`/clients/${clientId}/ai-video-studio/projects/${active.id}/assets`, {
        assetIds: Array.from(assetsDraft),
      });
      await refreshActive(active.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save assets');
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEnhancements() {
    if (!active) return;
    setBusy(true);
    try {
      await api.post(`/clients/${clientId}/ai-video-studio/projects/${active.id}/enhancements`, enhanceDraft);
      await refreshActive(active.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save enhancements');
    } finally {
      setBusy(false);
    }
  }

  async function onRender() {
    if (!active) return;
    setBusy(true);
    try {
      await api.post(`/clients/${clientId}/ai-video-studio/projects/${active.id}/render`);
      await refreshActive(active.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to render preview');
    } finally {
      setBusy(false);
    }
  }

  async function onExport() {
    if (!active) return;
    setBusy(true);
    try {
      await api.post(`/clients/${clientId}/ai-video-studio/projects/${active.id}/export`, {
        format: exportFormat,
      });
      await refreshActive(active.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to export');
    } finally {
      setBusy(false);
    }
  }

  async function onPublish() {
    if (!active) return;
    setBusy(true);
    try {
      await api.post(`/clients/${clientId}/ai-video-studio/projects/${active.id}/publish`);
      await refreshActive(active.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to publish');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    await api.delete(`/clients/${clientId}/ai-video-studio/projects/${id}`);
    if (active?.id === id) setActive(null);
    loadProjects();
  }

  function updateScene(i: number, patch: Partial<Scene>) {
    setScenesDraft((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function toggleAsset(id: string) {
    setAssetsDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const assetIcon = { video: Film, image: ImageIcon, music: Music };

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
        className="mt-4 grid grid-cols-[260px_1fr] gap-4"
      >
        <Card padding="sm" className="space-y-3">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">Projects</h2>
          <div className="space-y-1">
            {projects === null ? (
              <Skeleton className="h-10 w-full" />
            ) : projects.length === 0 ? (
              <p className="px-2 text-xs text-neutral-500">No projects yet.</p>
            ) : (
              projects.map((p) => (
                <div
                  key={p.id}
                  className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-xs ${
                    active?.id === p.id ? 'bg-accent-500/15 text-accent-200' : 'text-neutral-400 hover:bg-white/[0.05]'
                  }`}
                >
                  <button onClick={() => refreshActive(p.id)} className="flex-1 truncate text-left" title={p.title}>
                    {p.title}
                  </button>
                  <button onClick={() => onDelete(p.id)} className="shrink-0 opacity-0 group-hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5 text-neutral-500 hover:text-red-400" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-white/10 pt-3">
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">New video</h2>
            <form onSubmit={onCreate} className="space-y-2 px-1">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Title"
                required
                className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-2 text-xs text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
              />
              <textarea
                value={newIdea}
                onChange={(e) => setNewIdea(e.target.value)}
                placeholder="Idea or topic"
                rows={2}
                className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-2 text-xs text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
              />
              <Button type="submit" size="sm" className="w-full" loading={busy}>
                <Plus className="h-3.5 w-3.5" /> Create Project
              </Button>
            </form>
          </div>
        </Card>

        <div className="space-y-4">
          {!active ? (
            <Card padding="lg">
              <p className="text-sm text-neutral-400">
                Select a project on the left, or create a new one to start the pipeline.
              </p>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {STEPS.map((s, i) => (
                  <button
                    key={s.key}
                    disabled={i > maxReachable}
                    onClick={() => setActiveTab(s.key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      activeTab === s.key
                        ? 'border-accent-400/50 bg-accent-500/20 text-accent-200'
                        : 'border-white/12 bg-white/[0.04] text-neutral-400 hover:border-white/20'
                    }`}
                  >
                    {i + 1}. {s.label}
                  </button>
                ))}
              </div>

              <Card padding="lg" className="space-y-4">
                {activeTab === 'IDEA' && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-neutral-50">{active.title}</h3>
                    <p className="text-sm text-neutral-300">{active.idea || 'No idea text provided yet.'}</p>
                    <Button size="sm" onClick={onGenerateScript} loading={busy}>
                      <Sparkles className="h-3.5 w-3.5" /> Generate Script
                    </Button>
                  </div>
                )}

                {activeTab === 'SCRIPT' && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-neutral-50">AI Script</h3>
                    <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-sm text-neutral-300">
                      {active.script || 'No script generated yet.'}
                    </pre>
                    <Button size="sm" variant="secondary" onClick={onGenerateScript} loading={busy}>
                      Regenerate
                    </Button>
                  </div>
                )}

                {activeTab === 'STORYBOARD' && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-neutral-50">Scene Builder</h3>
                    {scenesDraft.map((scene, i) => (
                      <div key={i} className="space-y-2 rounded-xl border border-white/10 p-3">
                        <input
                          value={scene.title}
                          onChange={(e) => updateScene(i, { title: e.target.value })}
                          className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-sm text-neutral-50 outline-none focus:border-accent-400"
                        />
                        <textarea
                          value={scene.description}
                          onChange={(e) => updateScene(i, { description: e.target.value })}
                          rows={2}
                          className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-xs text-neutral-300 outline-none focus:border-accent-400"
                        />
                        <div className="flex items-center gap-2 text-xs text-neutral-400">
                          <span>Duration (sec)</span>
                          <input
                            type="number"
                            min={1}
                            value={scene.durationSec}
                            onChange={(e) => updateScene(i, { durationSec: Number(e.target.value) })}
                            className="w-16 rounded-lg border border-white/12 bg-white/[0.04] px-2 py-1 text-xs text-neutral-50 outline-none focus:border-accent-400"
                          />
                        </div>
                      </div>
                    ))}
                    <Button size="sm" onClick={onSaveStoryboard} loading={busy}>
                      Save Storyboard
                    </Button>
                  </div>
                )}

                {activeTab === 'ASSETS' && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-neutral-50">Media &amp; Assets</h3>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {STOCK_CATALOG.map((asset) => {
                        const Icon = assetIcon[asset.kind];
                        const selected = assetsDraft.has(asset.id);
                        return (
                          <button
                            key={asset.id}
                            onClick={() => toggleAsset(asset.id)}
                            className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs transition-colors ${
                              selected
                                ? 'border-accent-400/50 bg-accent-500/15 text-accent-200'
                                : 'border-white/12 bg-white/[0.04] text-neutral-400 hover:border-white/20'
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                            {asset.label}
                          </button>
                        );
                      })}
                    </div>
                    <Button size="sm" onClick={onSaveAssets} loading={busy}>
                      Save Assets ({assetsDraft.size} selected)
                    </Button>
                  </div>
                )}

                {activeTab === 'ENHANCE' && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-neutral-50">Edit &amp; Enhance</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {ENHANCE_TOGGLES.map((t) => (
                        <label
                          key={t.key}
                          className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-300"
                        >
                          <input
                            type="checkbox"
                            checked={!!enhanceDraft[t.key]}
                            onChange={(e) => setEnhanceDraft((prev) => ({ ...prev, [t.key]: e.target.checked }))}
                            className="h-4 w-4 accent-accent-500"
                          />
                          {t.label}
                        </label>
                      ))}
                    </div>
                    <input
                      value={enhanceDraft.backgroundMusic ?? ''}
                      onChange={(e) => setEnhanceDraft((prev) => ({ ...prev, backgroundMusic: e.target.value }))}
                      placeholder="Background music track"
                      className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
                    />
                    <Button size="sm" onClick={onSaveEnhancements} loading={busy}>
                      Save Enhancements
                    </Button>
                  </div>
                )}

                {activeTab === 'PREVIEW' && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-neutral-50">Preview</h3>
                    {active.previewUrl ? (
                      <div className="flex items-center gap-3">
                        <Image
                          src={active.previewUrl}
                          alt="Simulated render preview"
                          width={64}
                          height={64}
                          className="rounded-xl border border-white/10"
                        />
                        <Badge tone="warning">Simulated render — not a real video file</Badge>
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-400">Not rendered yet.</p>
                    )}
                    <Button size="sm" onClick={onRender} loading={busy}>
                      Render Preview
                    </Button>
                  </div>
                )}

                {activeTab === 'EXPORT' && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-neutral-50">Export</h3>
                    <select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value)}
                      className="w-full max-w-xs rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none focus:border-accent-400 [&>option]:bg-neutral-900"
                    >
                      <option value="MP4">MP4 — 1080p</option>
                      <option value="MOV">MOV — 1080p</option>
                      <option value="WEBM">WEBM — 720p</option>
                    </select>
                    {active.exportFormat && (
                      <p className="text-xs text-neutral-400">Last exported as {active.exportFormat}.</p>
                    )}
                    <Button size="sm" onClick={onExport} loading={busy}>
                      Export Video
                    </Button>
                  </div>
                )}

                {activeTab === 'PUBLISHED' && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-neutral-50">Publish</h3>
                    {active.publishedAt ? (
                      <Badge tone="success">Published {new Date(active.publishedAt).toLocaleString()}</Badge>
                    ) : (
                      <p className="text-sm text-neutral-400">Not published yet.</p>
                    )}
                    <p className="text-xs text-amber-300/80">
                      Publishing here just marks the project published — actual delivery uses
                      the same connected Social Accounts as Scheduler.
                    </p>
                    <Button size="sm" onClick={onPublish} loading={busy}>
                      Publish
                    </Button>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}
