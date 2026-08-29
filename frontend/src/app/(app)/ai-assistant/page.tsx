'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { useClientPicker } from '@/hooks/use-client-picker';
import { ClientPicker } from '@/components/client-picker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import { Bot, Plus, Send, Trash2, User as UserIcon } from 'lucide-react';

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  _count: { messages: number };
}

interface Message {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
}

const QUICK_PROMPTS = [
  'Create a content plan for next week',
  'Generate captions for a product launch',
  'What is the best time to post?',
  'Analyze last month’s performance',
];

export default function AiAssistantPage() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();

  return (
    <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">AI Assistant</h1>
        <p className="text-sm text-neutral-400">Ask anything about marketing, campaigns, or content.</p>
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

          {selectedClientId && <AssistantWorkspace key={selectedClientId} clientId={selectedClientId} />}
        </>
      )}
    </motion.div>
  );
}

function AssistantWorkspace({ clientId }: { clientId: string }) {
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  function loadConversations() {
    api
      .get<ConversationSummary[]>(`/clients/${clientId}/ai-assistant/conversations`)
      .then(setConversations)
      .catch(() => setConversations([]));
  }

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function openConversation(id: string) {
    setActiveId(id);
    const convo = await api.get<{ messages: Message[] }>(
      `/clients/${clientId}/ai-assistant/conversations/${id}`,
    );
    setMessages(convo.messages);
  }

  async function newConversation() {
    const convo = await api.post<{ id: string }>(`/clients/${clientId}/ai-assistant/conversations`, {});
    loadConversations();
    setActiveId(convo.id);
    setMessages([]);
  }

  async function removeConversation(id: string) {
    await api.delete(`/clients/${clientId}/ai-assistant/conversations/${id}`);
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
    loadConversations();
  }

  async function send(content: string) {
    if (!content.trim()) return;
    setError(null);
    setSending(true);

    let conversationId = activeId;
    try {
      if (!conversationId) {
        const convo = await api.post<{ id: string }>(`/clients/${clientId}/ai-assistant/conversations`, {});
        conversationId = convo.id;
        setActiveId(conversationId);
      }

      setMessages((prev) => [
        ...prev,
        { id: `temp-${Date.now()}`, role: 'USER', content, createdAt: new Date().toISOString() },
      ]);
      setInput('');

      const result = await api.post<{ userMessage: Message; assistantMessage: Message }>(
        `/clients/${clientId}/ai-assistant/conversations/${conversationId}/messages`,
        { content },
      );

      setMessages((prev) => [
        ...prev.filter((m) => !m.id.startsWith('temp-')),
        result.userMessage,
        result.assistantMessage,
      ]);
      loadConversations();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      transition={{ duration: DURATION.base, ease: EASE_SOFT }}
      className="grid grid-cols-[260px_1fr] gap-4"
    >
      <Card padding="sm" className="flex h-[560px] flex-col">
        <Button size="sm" onClick={newConversation} className="mb-3 w-full">
          <Plus className="h-4 w-4" /> New Chat
        </Button>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {conversations === null ? (
            <p className="px-2 text-xs text-neutral-500">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="px-2 text-xs text-neutral-500">No conversations yet.</p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-xs ${
                  activeId === c.id ? 'bg-accent-500/15 text-accent-200' : 'text-neutral-400 hover:bg-white/[0.05]'
                }`}
              >
                <button onClick={() => openConversation(c.id)} className="flex-1 truncate text-left" title={c.title}>
                  {c.title}
                </button>
                <button onClick={() => removeConversation(c.id)} className="shrink-0 opacity-0 group-hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5 text-neutral-500 hover:text-red-400" />
                </button>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card padding="none" className="flex h-[560px] flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <Bot className="h-10 w-10 text-accent-300" />
              <p className="text-sm text-neutral-400">Ask. Understand. Get Results. Try a quick prompt below.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-300 hover:border-accent-400/40 hover:text-accent-200"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-2.5 ${m.role === 'USER' ? 'justify-end' : ''}`}>
              {m.role === 'ASSISTANT' && (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-500/20 text-accent-300">
                  <Bot className="h-4 w-4" />
                </span>
              )}
              <div
                className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === 'USER'
                    ? 'bg-gradient-to-r from-accent-400 via-accent-500 to-fuchsia-500 text-white'
                    : 'card-surface text-neutral-200'
                }`}
              >
                {m.content}
              </div>
              {m.role === 'USER' && (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-neutral-300">
                  <UserIcon className="h-4 w-4" />
                </span>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {error && <p className="px-5 pb-2 text-xs text-red-300">{error}</p>}

        <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-white/10 p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything related to marketing, campaigns or content…"
            className="flex-1 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
          />
          <Button type="submit" size="sm" loading={sending} disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </motion.div>
  );
}
