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
import { Save, Sparkles, Trash2 } from 'lucide-react';

const TONES = ['Friendly', 'Professional', 'Playful', 'Bold'] as const;
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

interface Variant {
  text: string;
  hashtags: string[];
}

interface SavedCaption extends Variant {
  id: string;
  input: string;
  tone: string;
  platform: (typeof PLATFORMS)[number] | null;
  createdAt: string;
}

export default function AiCaptionsPage() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();
  const [input, setInput] = useState('');
  const [tone, setTone] = useState<(typeof TONES)[number]>('Friendly');
  const [platform, setPlatform] = useState<'' | (typeof PLATFORMS)[number]>('');
  const [variants, setVariants] = useState<Variant[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState<SavedCaption[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadSaved(clientId: string) {
    api.get<SavedCaption[]>(`/clients/${clientId}/ai-captions`).then(setSaved).catch(() => setSaved([]));
  }

  useEffect(() => {
    if (selectedClientId) loadSaved(selectedClientId);
  }, [selectedClientId]);

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    if (!selectedClientId || !input.trim()) return;
    setError(null);
    setGenerating(true);
    try {
      const result = await api.post<Variant[]>(`/clients/${selectedClientId}/ai-captions/generate`, {
        input,
        tone,
        platform: platform || undefined,
      });
      setVariants(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate captions');
    } finally {
      setGenerating(false);
    }
  }

  async function onSave(variant: Variant) {
    if (!selectedClientId) return;
    try {
      await api.post(`/clients/${selectedClientId}/ai-captions`, {
        input,
        tone,
        platform: platform || undefined,
        text: variant.text,
        hashtags: variant.hashtags,
      });
      loadSaved(selectedClientId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save caption');
    }
  }

  async function onDelete(id: string) {
    if (!selectedClientId) return;
    await api.delete(`/clients/${selectedClientId}/ai-captions/${id}`);
    setSaved((prev) => prev?.filter((c) => c.id !== id) ?? null);
  }

  return (
    <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show" className="max-w-3xl space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">AI Captions</h1>
        <p className="text-sm text-neutral-400">From idea to perfect captions.</p>
        <p className="mt-2 text-xs text-amber-300/80">
          No Anthropic API key is configured, so captions below are generated from heuristics,
          not a real Claude call — swap in a key later with no UI changes needed.
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
              <h2 className="mb-4 text-sm font-semibold text-neutral-50">Generate captions</h2>
              <form onSubmit={onGenerate} className="space-y-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="What's the post about? e.g. New summer collection launch for women."
                  rows={3}
                  required
                  className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Tone" value={tone} onChange={(e) => setTone(e.target.value as (typeof TONES)[number])}>
                    {TONES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="Platform (optional)"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as (typeof PLATFORMS)[number] | '')}
                  >
                    <option value="">All platforms</option>
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" loading={generating}>
                  <Sparkles className="h-4 w-4" /> Generate Captions
                </Button>
              </form>
            </Card>
          </motion.div>

          {variants && (
            <motion.div
              variants={fadeUp}
              transition={{ duration: DURATION.base, ease: EASE_SOFT }}
              className="space-y-3"
            >
              <h2 className="text-sm font-semibold text-neutral-50">Variants</h2>
              {variants.map((v, i) => (
                <Card key={i} padding="md" className="space-y-2">
                  <p className="text-sm text-neutral-200">{v.text}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {v.hashtags.map((h) => (
                      <Badge key={h} tone="accent">
                        {h}
                      </Badge>
                    ))}
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => onSave(v)}>
                    <Save className="h-3.5 w-3.5" /> Save
                  </Button>
                </Card>
              ))}
            </motion.div>
          )}

          <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }} className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-50">Saved &amp; history</h2>
            {saved === null ? (
              <Skeleton className="h-16 w-full rounded-2xl" />
            ) : saved.length === 0 ? (
              <Card padding="lg">
                <p className="text-sm text-neutral-400">No saved captions yet.</p>
              </Card>
            ) : (
              <ul className="space-y-3">
                <AnimatePresence initial={false}>
                  {saved.map((c) => (
                    <motion.li
                      key={c.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: DURATION.base, ease: EASE_SOFT }}
                    >
                      <Card padding="md" className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone="neutral">{c.tone}</Badge>
                            {c.platform && <Badge tone="neutral">{c.platform}</Badge>}
                          </div>
                          <button onClick={() => onDelete(c.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-neutral-500 hover:text-red-400" />
                          </button>
                        </div>
                        <p className="text-sm text-neutral-200">{c.text}</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {c.hashtags.map((h) => (
                            <span key={h} className="text-xs text-accent-300">
                              {h}
                            </span>
                          ))}
                        </div>
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
