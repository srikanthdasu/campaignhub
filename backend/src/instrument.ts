import 'dotenv/config';
import * as Sentry from '@sentry/nestjs';

// Must be the very first import in every entry point (main.ts, combined-server.ts) — Sentry's
// auto-instrumentation patches Node's built-in modules (http, etc.) and can only do that
// correctly if it runs before anything else has already required them. That in turn means this
// runs before NestJS's own ConfigModule (which normally loads .env) has had a chance to —
// `dotenv/config` loads .env into process.env directly, independent of Nest's bootstrap order.
// A no-op in production, where Azure App Service injects env vars straight into the process
// with no .env file involved at all.
//
// Optional, same degrade-gracefully pattern as EmailService/BlobStorageService: no SENTRY_DSN
// means no error tracking, not a broken app — this is a monitoring nice-to-have, not something
// that should ever block a request or a deploy.
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
  });
}
