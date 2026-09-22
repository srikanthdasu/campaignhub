import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

// Local dev runs the API on its own port with no prefix (frontend talks to it as a separate
// origin). The combined production server (combined-server.ts) sets API_PREFIX=api so this same
// app can share one Express instance/port with the Next.js frontend without route collisions —
// this factory is shared so both entry points get identical middleware/guards/pipes. Kept in its
// own file with no top-level side effects, unlike main.ts, so importing it never starts a server.
export async function createApp(): Promise<NestExpressApplication> {
  // rawBody: true keeps req.rawBody (the exact bytes Nest's body parser received) available
  // alongside the normal parsed req.body — needed to verify the Razorpay webhook's HMAC
  // signature, which is computed over the raw payload and would mismatch against any
  // re-serialization of the parsed object (different key order/whitespace = different bytes).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  const apiPrefix = config.get<string>('API_PREFIX', '');

  // Azure App Service terminates TLS at a front-end proxy and forwards over a local connection —
  // without this, req.ip resolves to the proxy for every request, collapsing the rate limiter's
  // per-IP buckets (login, register, AI generation) into one shared bucket for all real visitors.
  app.set('trust proxy', 1);

  // crossOriginResourcePolicy relaxed so the frontend (a different origin in local dev) can
  // render uploaded media via <img>/<video> src — CORS below still governs actual API calls.
  //
  // CSP: helmet's *default* script-src ('self' only, no 'unsafe-inline') is what broke the
  // combined server's frontend before (React error #412 — Next.js's own hydration bootstrap is
  // an inline script, which a bare 'self' policy blocks). This isn't Next's documented
  // nonce-based CSP pattern (that needs per-request middleware this app doesn't have yet) — it's
  // a deliberately permissive script-src/style-src that only re-adds the protection CSP is
  // actually for here: blocking a script/style tag pointed at an attacker-controlled external
  // domain. That was the gap with CSP off entirely, and this closes it without touching how
  // Next.js hydrates. Verified locally against the built combined server (backend/dist +
  // frontend build-output), not just typechecked, given this exact configuration broke
  // production once already. 'unsafe-eval' was dropped from scriptSrc below after the same
  // local verification (full hydration, Google Sign-In button, Three.js background all worked
  // with it removed) — a production Next.js build doesn't use eval-based devtool source maps,
  // so it was never actually needed, only 'unsafe-inline' is required for the hydration bootstrap.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // 'https://accounts.google.com/gsi/client' + frameSrc/connectSrc below let Google
          // Identity Services load its script, render its iframe-based Sign-In button, and make
          // its own network calls — needed for Google Sign-In (auth.service.ts googleAuth()).
          scriptSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com/gsi/client'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com/gsi/style'],
          // https://*.blob.core.windows.net: MediaAsset URLs are Azure Blob SAS links
          // (BlobStorageService.getReadUrl) once AZURE_STORAGE_CONNECTION_STRING is configured —
          // without this, CSP would block every uploaded image/video the moment that happens.
          imgSrc: ["'self'", 'data:', 'blob:', 'https://*.blob.core.windows.net'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'", 'https://accounts.google.com'],
          frameSrc: ['https://accounts.google.com'],
          mediaSrc: ["'self'", 'blob:', 'https://*.blob.core.windows.net'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  // Lets an in-flight request finish before the old process actually exits during a deploy,
  // instead of being dropped mid-response the moment the new version's container takes over.
  app.enableShutdownHooks();
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Local-disk uploads used to be served here via unauthenticated static middleware, outside
  // the /api prefix — anyone with a blob's filename could read it, dev fallback or not.
  // MediaFilesController (media-files.controller.ts) replaces it with a token-gated
  // /media-files/:filename route; see BlobStorageService.getReadUrl for where the signed URL
  // actually gets generated. Excluded from the prefix below so it stays reachable at the same
  // unprefixed path the old static middleware used — resolveMediaUrl() on the frontend already
  // resolves relative media paths against the API origin with /api stripped, matching this.
  if (apiPrefix) {
    app.setGlobalPrefix(apiPrefix, {
      exclude: [{ path: 'media-files/:filename', method: RequestMethod.GET }],
    });
  }

  return app;
}
