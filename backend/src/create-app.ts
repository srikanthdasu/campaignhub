import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

// Resolved from this module's own location, not process.cwd() — the latter depends on how/where
// the process was launched (e.g. Azure App Service's startup command may run from a different
// working directory than this file lives in), so it isn't reliable for finding sibling folders.
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = join(MODULE_DIR, '..', 'uploads'); // backend/dist/../uploads = backend/uploads

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
  // production once already.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          mediaSrc: ["'self'", 'blob:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(cookieParser());
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
  app.useStaticAssets(UPLOAD_DIR, { prefix: '/uploads' });
  if (apiPrefix) app.setGlobalPrefix(apiPrefix);

  return app;
}
