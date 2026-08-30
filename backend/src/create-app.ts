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
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const apiPrefix = config.get<string>('API_PREFIX', '');

  // crossOriginResourcePolicy relaxed so the frontend (a different origin in local dev) can
  // render uploaded media via <img>/<video> src — CORS below still governs actual API calls.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
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
