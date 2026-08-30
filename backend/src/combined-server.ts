import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ConfigService } from '@nestjs/config';
import { createApp } from './create-app.js';
// Next.js's public types don't model the programmatic custom-server factory as callable (a
// long-standing gap — custom servers aren't an officially documented Next.js pattern anymore),
// even though `next/dist/server/next.js`'s actual runtime export is exactly that factory
// function. Import the real module and cast past the type gap rather than fight it.
import * as nextModule from 'next/dist/server/next.js';

interface NextAppInstance {
  prepare(): Promise<void>;
  getRequestHandler(): (req: unknown, res: unknown) => unknown;
}
type NextServerFactory = (options: { dev: boolean; dir: string }) => NextAppInstance;
const next = (nextModule as unknown as { default: NextServerFactory }).default;

// Single-process production entry point: serves the NestJS API under /api on the same port
// as the built Next.js frontend, so one Azure App Service instance can host both. Local dev
// (main.ts, `npm run start:dev`) is untouched — it always runs API-only, unprefixed, and the
// frontend runs as its own separate `next dev` process on its own port, as it always has.
//
// Deployment layout this expects (see .github/workflows/deploy.yml): this file compiled to
// backend/dist/combined-server.js, with a sibling ../frontend directory containing the built
// Next.js app (frontend/.next, frontend/node_modules, frontend/public, frontend/package.json).
async function bootstrap() {
  process.env.API_PREFIX ||= 'api';

  const app = await createApp();
  const config = app.get(ConfigService);
  await app.init();

  const expressApp = app.getHttpAdapter().getInstance();
  // Resolved from this compiled file's own location (backend/dist/combined-server.js), not
  // process.cwd() — same reasoning as create-app.ts's UPLOAD_DIR.
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const frontendDir = join(moduleDir, '..', '..', 'frontend');
  const nextApp = next({ dev: false, dir: frontendDir });
  await nextApp.prepare();
  const handleNextRequest = nextApp.getRequestHandler();

  // Registered after app.init(), so every /api/* Nest route is already matched first —
  // this only catches what Nest and the /uploads static middleware didn't handle.
  expressApp.all(/.*/, (req, res) => handleNextRequest(req, res));

  await app.listen(config.get<number>('PORT', 8080));
}
await bootstrap();
