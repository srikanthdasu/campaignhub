'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trash2, Upload, FileText, Music } from 'lucide-react';
import { api, ApiError, resolveMediaUrl } from '@/lib/api';
import { useClientPicker } from '@/hooks/use-client-picker';
import { ClientPicker } from '@/components/client-picker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

interface MediaAsset {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'GIF' | 'AUDIO' | 'DOCUMENT';
  storageUrl: string;
  fileName: string;
  usageCount: number;
  createdAt: string;
}

export default function MediaLibraryPage() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();
  const [assets, setAssets] = useState<MediaAsset[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function loadAssets(clientId: string) {
    api
      .get<MediaAsset[]>(`/clients/${clientId}/media`)
      .then(setAssets)
      .catch(() => setAssets([]));
  }

  useEffect(() => {
    if (selectedClientId) loadAssets(selectedClientId);
  }, [selectedClientId]);

  async function onFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedClientId) return;

    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      await api.upload(`/clients/${selectedClientId}/media`, form);
      loadAssets(selectedClientId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(id: string) {
    if (!selectedClientId) return;
    try {
      await api.delete(`/clients/${selectedClientId}/media/${id}`);
      setAssets((prev) => prev?.filter((a) => a.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete asset');
    }
  }

  return (
    <motion.div
      variants={staggerContainer(0.08)}
      initial="hidden"
      animate="show"
      className="max-w-5xl space-y-6"
    >
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Media Library</h1>
        <p className="text-sm text-neutral-400">
          Upload and organize images, videos, and other assets for a client.
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
          <motion.div
            variants={fadeUp}
            transition={{ duration: DURATION.base, ease: EASE_SOFT }}
            className="flex items-end justify-between gap-4"
          >
            {clients && (
              <ClientPicker
                clients={clients}
                value={selectedClientId}
                onChange={setSelectedClientId}
              />
            )}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={onFileSelected}
                disabled={!selectedClientId || uploading}
              />
              <Button
                loading={uploading}
                disabled={!selectedClientId}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" strokeWidth={2} />
                {uploading ? 'Uploading…' : 'Upload file'}
              </Button>
            </div>
          </motion.div>

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
            {assets === null ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-2xl" />
                ))}
              </div>
            ) : assets.length === 0 ? (
              <Card padding="lg">
                <p className="text-sm text-neutral-400">No media uploaded yet.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
                      <Card padding="none" hoverable className="group overflow-hidden">
                        <div className="relative aspect-square bg-white/[0.03]">
                          {asset.type === 'IMAGE' || asset.type === 'GIF' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={resolveMediaUrl(asset.storageUrl)}
                              alt={asset.fileName}
                              className="h-full w-full object-cover"
                            />
                          ) : asset.type === 'VIDEO' ? (
                            <video
                              src={resolveMediaUrl(asset.storageUrl)}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              {asset.type === 'AUDIO' ? (
                                <Music className="h-8 w-8 text-neutral-500" />
                              ) : (
                                <FileText className="h-8 w-8 text-neutral-500" />
                              )}
                            </div>
                          )}
                          <button
                            onClick={() => onDelete(asset.id)}
                            className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-white" strokeWidth={2} />
                          </button>
                        </div>
                        <div className="p-2.5">
                          <p className="truncate text-xs font-medium text-neutral-200">
                            {asset.fileName}
                          </p>
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
