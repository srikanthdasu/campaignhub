'use client';

import { FormEvent, useState } from 'react';
import { motion } from 'framer-motion';
import { MarketingHeader } from '@/components/marketing-header';
import { MarketingFooter } from '@/components/marketing-footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

export default function BookDemoPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/marketing/request-demo', {
        name,
        email,
        agencyName: agencyName.trim() || undefined,
        message: message.trim() || undefined,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <MarketingHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-6 pb-24 pt-8">
        <div className="text-center">
          <span className="rounded-full border border-accent-400/30 bg-accent-500/15 px-3.5 py-1.5 text-xs font-medium uppercase tracking-wide text-accent-200">
            Book a demo
          </span>
          <h1 className="mt-4 text-4xl font-semibold text-balance text-neutral-50">
            See CampaignHub AI on your own workflow.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-lg text-neutral-400">
            Tell us a bit about your agency and we&apos;ll reach out to set up a time — or just
            explore the product yourself right now with our shared demo login from the sign-in
            page.
          </p>
        </div>

        <Card padding="lg" className="mt-10 w-full max-w-md">
          {sent ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.base, ease: EASE_SOFT }}
              className="space-y-3 text-center"
            >
              <h2 className="text-xl font-semibold text-neutral-50">Thanks, {name.split(' ')[0]}!</h2>
              <p className="text-sm leading-relaxed text-neutral-400">
                We got your request and sent a confirmation to {email}. We&apos;ll be in touch
                shortly to set up a time.
              </p>
            </motion.div>
          ) : (
            <motion.form
              onSubmit={onSubmit}
              variants={staggerContainer(0.06)}
              initial="hidden"
              animate="show"
              className="space-y-4"
            >
              {error && (
                <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
                  {error}
                </p>
              )}

              <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
                <Input
                  id="name"
                  label="Your name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </motion.div>

              <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
                <Input
                  id="email"
                  label="Email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </motion.div>

              <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
                <Input
                  id="agencyName"
                  label="Agency name (optional)"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                />
              </motion.div>

              <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
                <Textarea
                  id="message"
                  label="What are you hoping to solve? (optional)"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. we lose track of approvals across too many clients"
                />
              </motion.div>

              <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
                <Button type="submit" loading={submitting} className="w-full">
                  {submitting ? 'Sending…' : 'Request a demo'}
                </Button>
              </motion.div>
            </motion.form>
          )}
        </Card>
      </main>

      <MarketingFooter />
    </div>
  );
}
