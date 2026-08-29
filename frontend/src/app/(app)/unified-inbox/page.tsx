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

interface InboxMessage {
  id: string;
  platform: (typeof PLATFORMS)[number];
  senderName: string;
  message: string;
  isRead: boolean;
  receivedAt: string;
}

export default function UnifiedInboxPage() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();
  const [messages, setMessages] = useState<InboxMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const [simPlatform, setSimPlatform] = useState<(typeof PLATFORMS)[number]>('INSTAGRAM');
  const [simSender, setSimSender] = useState('');
  const [simMessage, setSimMessage] = useState('');
  const [simulating, setSimulating] = useState(false);

  function load(clientId: string) {
    api
      .get<InboxMessage[]>(`/clients/${clientId}/inbox`)
      .then(setMessages)
      .catch(() => setMessages([]));
  }

  useEffect(() => {
    if (selectedClientId) load(selectedClientId);
  }, [selectedClientId]);

  async function onSimulate(e: FormEvent) {
    e.preventDefault();
    if (!selectedClientId) return;
    setError(null);
    setSimulating(true);
    try {
      await api.post(`/clients/${selectedClientId}/inbox/simulate`, {
        platform: simPlatform,
        senderName: simSender,
        message: simMessage,
      });
      setSimSender('');
      setSimMessage('');
      load(selectedClientId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to simulate message');
    } finally {
      setSimulating(false);
    }
  }

  async function onMarkRead(id: string) {
    if (!selectedClientId) return;
    try {
      await api.patch(`/clients/${selectedClientId}/inbox/${id}/read`);
      setMessages((prev) => prev?.map((m) => (m.id === id ? { ...m, isRead: true } : m)) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to mark as read');
    }
  }

  async function onReply(id: string) {
    if (!selectedClientId || !replyText.trim()) return;
    try {
      await api.post(`/clients/${selectedClientId}/inbox/${id}/reply`, { reply: replyText });
      setReplyingId(null);
      setReplyText('');
      load(selectedClientId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send reply');
    }
  }

  return (
    <motion.div
      variants={staggerContainer(0.08)}
      initial="hidden"
      animate="show"
      className="max-w-2xl space-y-6"
    >
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Unified Inbox</h1>
        <p className="text-sm text-neutral-400">
          Comments and DMs across every connected platform, in one place.
        </p>
        <p className="mt-2 text-xs text-amber-300/80">
          No live platform connection exists yet, so messages arrive here via the simulator
          below rather than real webhooks. Replies are logged, not delivered.
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
              <h2 className="mb-4 text-sm font-semibold text-neutral-50">Simulate a test message</h2>
              <form onSubmit={onSimulate} className="grid grid-cols-2 gap-3">
                <Select
                  value={simPlatform}
                  onChange={(e) => setSimPlatform(e.target.value as (typeof PLATFORMS)[number])}
                >
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
                <input
                  placeholder="Sender name"
                  value={simSender}
                  onChange={(e) => setSimSender(e.target.value)}
                  required
                  className="rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
                />
                <input
                  placeholder="Message"
                  value={simMessage}
                  onChange={(e) => setSimMessage(e.target.value)}
                  required
                  className="col-span-2 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
                />
                <Button type="submit" loading={simulating} size="sm" className="col-span-2 w-fit">
                  Add test message
                </Button>
              </form>
            </Card>
          </motion.div>

          <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
            {messages === null ? (
              <Skeleton className="h-16 w-full rounded-2xl" />
            ) : messages.length === 0 ? (
              <Card padding="lg">
                <p className="text-sm text-neutral-400">No messages yet.</p>
              </Card>
            ) : (
              <ul className="space-y-3">
                <AnimatePresence initial={false}>
                  {messages.map((m) => (
                    <motion.li
                      key={m.id}
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
                              <Badge tone="neutral">{m.platform}</Badge>
                              {!m.isRead && <Badge tone="accent">New</Badge>}
                              <span className="text-sm font-medium text-neutral-200">
                                {m.senderName}
                              </span>
                            </div>
                            <p className="mt-1.5 text-sm text-neutral-300">{m.message}</p>
                            <p className="mt-1 text-xs text-neutral-500">
                              {new Date(m.receivedAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            {!m.isRead && (
                              <Button size="sm" variant="secondary" onClick={() => onMarkRead(m.id)}>
                                Mark read
                              </Button>
                            )}
                            <Button
                              size="sm"
                              onClick={() => setReplyingId(replyingId === m.id ? null : m.id)}
                            >
                              Reply
                            </Button>
                          </div>
                        </div>

                        <AnimatePresence>
                          {replyingId === m.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="mt-3 overflow-hidden border-t border-white/10 pt-3"
                            >
                              <div className="flex gap-2">
                                <input
                                  placeholder="Write a reply…"
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  className="flex-1 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
                                />
                                <Button size="sm" onClick={() => onReply(m.id)}>
                                  Send
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
