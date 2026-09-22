import * as Sentry from '@sentry/nextjs';

// Called once when the Next.js server starts — see Next.js's instrumentation.ts convention.
// Covers both runtimes this app can run under: the Node.js server (local dev's `next dev`,
// production's combined-server.ts) and Next's Edge runtime (middleware, if any is added later).
// Same optional, degrade-gracefully pattern as the client side — no DSN, no tracking.
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
  });
}

export const onRequestError = Sentry.captureRequestError;
