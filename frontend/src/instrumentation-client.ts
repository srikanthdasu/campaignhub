import * as Sentry from '@sentry/nextjs';

// Runs before React hydration on every page load — see Next.js's instrumentation-client
// convention. Optional, same degrade-gracefully pattern as the backend's instrument.ts: no
// NEXT_PUBLIC_SENTRY_DSN means no error tracking, not a broken app.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
  });
}

// Required export per Sentry's Next.js integration so App Router client-side navigations are
// captured as breadcrumbs — without it, an error's context is missing "which page was the user
// on right before this happened."
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
