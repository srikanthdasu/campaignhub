'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api';
import { DURATION, EASE_SOFT } from '@/lib/motion';

interface Notification {
  id: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  function loadCount() {
    api.get<{ count: number }>('/notifications/unread-count').then((r) => setUnreadCount(r.count));
  }

  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function toggleOpen() {
    setOpen((prev) => {
      const next = !prev;
      if (next) api.get<Notification[]>('/notifications').then(setNotifications);
      return next;
    });
  }

  async function onNotificationClick(n: Notification) {
    if (!n.isRead) {
      await api.post(`/notifications/${n.id}/read`);
      loadCount();
      setNotifications((prev) => prev?.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)) ?? null);
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  async function onMarkAllRead() {
    await api.post('/notifications/read-all');
    setUnreadCount(0);
    setNotifications((prev) => prev?.map((x) => ({ ...x, isRead: true })) ?? null);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={toggleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-neutral-300 hover:bg-white/[0.06]"
      >
        <Bell className="h-4.5 w-4.5" strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-accent-400 to-fuchsia-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: DURATION.fast, ease: EASE_SOFT }}
            className="card-surface absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-sm font-semibold text-neutral-50">Notifications</span>
              {unreadCount > 0 && (
                <button onClick={onMarkAllRead} className="text-xs text-accent-300 hover:text-accent-200">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications === null ? (
                <p className="px-4 py-6 text-center text-xs text-neutral-500">Loading…</p>
              ) : notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-neutral-500">No notifications yet.</p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => onNotificationClick(n)}
                    className={`block w-full border-b border-white/5 px-4 py-3 text-left text-xs last:border-0 hover:bg-white/[0.04] ${
                      n.isRead ? 'text-neutral-400' : 'text-neutral-100'
                    }`}
                  >
                    <span className="flex items-start gap-2">
                      {!n.isRead && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" />}
                      <span className="flex-1">
                        {n.message}
                        <span className="mt-0.5 block text-[10px] text-neutral-500">
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
