'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api, ApiError } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// The public demo account (shared login, promoted on WhatsApp/social) lets anyone try the
// product without signing up — but that means every visitor looks identical in the login logs.
// The first time this specific account logs in on a given browser, ask who's visiting so we can
// follow up about pricing. Required, not skippable: a headcount without an identity defeats the
// point, and this is the only way to attach one to a shared login.
const DEMO_ACCOUNT_EMAIL = 'demo@campaignhubai.app';
const STORAGE_KEY = 'demo-lead-captured';

// Stable reference (not an inline arrow in JSX) — Modal's focus-trap effect depends on
// [open, onClose], and a new onClose identity on every keystroke re-ran that effect and yanked
// focus back to the dialog's first focusable element after each character typed.
function noop() {}

export function DemoLeadGate() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.email !== DEMO_ACCOUNT_EMAIL) return;
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(STORAGE_KEY)) return;
    setOpen(true);
  }, [user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/demo-leads', { name: name.trim(), email: email.trim() });
      window.localStorage.setItem(STORAGE_KEY, '1');
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (user?.email !== DEMO_ACCOUNT_EMAIL) return null;

  return (
    <Modal open={open} onClose={noop} title="Welcome to the CampaignHub AI demo" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-neutral-400">
          Quick intro before you look around — this helps us follow up if you&apos;d like your own
          account and pricing afterward.
        </p>
        <Input
          label="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
          required
          maxLength={150}
          autoFocus
        />
        <Input
          label="Your email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@example.com"
          required
          maxLength={255}
        />
        {error && (
          <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" loading={submitting}>
          Continue to the demo
        </Button>
      </form>
    </Modal>
  );
}
