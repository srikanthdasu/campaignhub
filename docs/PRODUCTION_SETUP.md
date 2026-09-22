# Production Setup

How CampaignHub AI is actually configured and deployed in production. This exists so
production configuration isn't only known by whoever set up the Azure resources — anyone
picking this up cold should be able to reconstruct the whole picture from this file.

## Architecture: one process, one port

Production runs a **single combined Node.js process** (`backend/src/combined-server.ts`,
compiled to `backend/dist/combined-server.js`) that serves both the NestJS API and the built
Next.js frontend from one Azure App Service instance on one port:

- Every NestJS route is mounted under `/api` (`combined-server.ts` sets `API_PREFIX=api`
  before the app boots).
- Every other request falls through to Next.js's request handler, serving the pre-built
  frontend from `frontend/build-output` (Next's default `.next` output dir is renamed via
  `distDir: "build-output"` in `frontend/next.config.ts` — Azure's zip-deploy pipeline was
  found to silently drop dot-prefixed directories, which broke the default `.next` name).

Local development is unaffected by any of this: `npm run start:dev` in `backend/` runs
`main.ts`, which boots the API alone, unprefixed, on its own port, while `next dev` runs the
frontend as a separate process on its own port — the split-origin setup most Next.js docs
assume.

**Startup command** (Azure App Service → Configuration → General settings → Startup Command):

```
node dist/combined-server.js
```

Run from the deployed package's `backend/` directory (see "What actually ships" below for the
package layout `azure/webapps-deploy` receives).

**Port**: Azure App Service (Linux, Node) injects its own `PORT` value and expects the app to
listen on it. `combined-server.ts` reads it via `config.get<number>('PORT', 8080)` — no
App Setting needs to be added for this, Azure supplies it automatically.

## App Settings (environment variables)

Everything below is read via NestJS `ConfigService` (`config.get`/`config.getOrThrow`) somewhere
in `backend/src/**`. "Required" means the app throws — either at startup (`validate-env.ts`) or
the first time the reading code path is hit (`getOrThrow`) — if it's missing. "Optional" means a
service checks for it and degrades to a fallback behavior instead of failing.

### Core (required — the app will not start, or the most basic flows will not work, without these)

| Setting | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | `prisma.service.ts` | Postgres connection string. |
| `JWT_ACCESS_SECRET` | `jwt.strategy.ts`, `auth.service.ts` | Must be ≥ 20 chars — `validate-env.ts` rejects a shorter value (including an un-replaced `.env.example` default) at startup. |
| `JWT_REFRESH_SECRET` | `auth.service.ts` | Same 20-char minimum, validated at startup. |
| `TOKEN_ENCRYPTION_KEY` | `social-accounts.service.ts`, `scheduler.service.ts` | Encrypts connected social accounts' OAuth tokens at rest (AES-256-GCM). Same 20-char minimum. |
| `PUBLIC_APP_URL` | `auth.service.ts`, every `*-oauth.service.ts`, `email-campaigns.service.ts` | The single combined origin (e.g. `https://campaignhub-app2.azurewebsites.net`). Builds absolute links for email verification and OAuth redirect URIs — read via `getOrThrow`, so any of those flows fails fast (not silently) without it. |
| `CORS_ORIGIN` | `create-app.ts` | Defaults to `http://localhost:3000` if unset — **must** be set to the real production origin, or the default silently permits only local dev's origin. |

### Production-only gate

| Setting | Used by | Notes |
|---|---|---|
| `NODE_ENV=production` | `validate-env.ts`, `auth.controller.ts` (secure cookie flag) | When set to `production`, `validate-env.ts` additionally *requires* all four SMTP settings and `AZURE_STORAGE_CONNECTION_STRING` below — the app refuses to start rather than degrading silently. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | `email.service.ts` | Required in production (see above). In any other `NODE_ENV`, missing values just make `EmailService` log what it would have sent instead of failing. |
| `SMTP_FROM` | `email.service.ts` | Optional even in production — defaults to `"CampaignHub AI" <no-reply@campaignhub.ai>"`. |
| `AZURE_STORAGE_CONNECTION_STRING` | `blob-storage.service.ts` | Required in production (see above and "Media storage" below) — without it, uploads would silently fall back to non-durable local disk. |

### Azure AI Foundry (AI Captions, AI Assistant, AI Strategy, AI Video Studio's script step)

| Setting | Notes |
|---|---|
| `AZURE_AI_FOUNDRY_ENDPOINT` | The project's OpenAI-compatible chat completions URL. |
| `AZURE_AI_FOUNDRY_KEY` | |
| `AZURE_AI_FOUNDRY_TEXT_MODEL` | e.g. `Llama-3.3-70B-Instruct`. |
| `AZURE_AI_FOUNDRY_IMAGE_ENDPOINT` | Same Foundry project, a *different* endpoint path — the image-generation deployment, used by AI Video Studio's render step. |
| `AZURE_AI_FOUNDRY_IMAGE_KEY` | |
| `AZURE_AI_FOUNDRY_IMAGE_MODEL` | e.g. `MAI-Image-2.5-Flash`. |
| `AI_TEXT_GENERATION_ENABLED` | Emergency spend kill switch — defaults **on**; set to the literal string `"false"` to disable text generation without a deploy. |
| `AI_IMAGE_GENERATION_ENABLED` | Same pattern, for image generation. |

All six `AZURE_AI_FOUNDRY_*` settings are read via `getOrThrow` inside `chat()`/`generateImage()`
— missing any of them throws the first time that specific call path is hit, not at startup.

### Billing (Razorpay)

| Setting | Notes |
|---|---|
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Checkout order creation + payment signature verification. |
| `RAZORPAY_WEBHOOK_SECRET` | A **separate** secret from `RAZORPAY_KEY_SECRET` — set when creating the webhook (Razorpay dashboard → Settings → Webhooks) pointed at `POST /api/billing/webhooks/razorpay`, subscribed to `payment.captured`. Activates a subscription server-side even if the browser never calls back after payment. |

### Media storage

| Setting | Notes |
|---|---|
| `AZURE_STORAGE_CONNECTION_STRING` | **Required in production** (`validate-env.ts` refuses to start without it when `NODE_ENV=production`) — `blob-storage.service.ts` otherwise falls back to writing uploads to local disk (`backend/uploads`), and Azure App Service's local disk is **not durable** (wiped on restart/scale/slot-swap). Optional outside production, to keep local dev working without an Azure Storage account. |

### Sign in with Google

| Setting | Notes |
|---|---|
| `GOOGLE_CLIENT_ID` | Optional — if unset, `POST /api/auth/google` returns a clear "not configured" error rather than the app failing to start. No client secret needed (ID-token verification checks the signature against Google's published keys, not a server-to-server exchange). |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (frontend, **build-time**) | Same value, baked into the client bundle by `next build` — see "Frontend build-time variables" below. Without it, `GoogleSignInButton` silently renders nothing (no error). |

### Social platform OAuth (Social Accounts — Phase 3)

Each platform's Client ID/Secret is read via `getOrThrow` only when that specific platform's
connect flow is used — an unconfigured platform has no effect on the rest of the app.

| Platform | Settings |
|---|---|
| Meta (Facebook) | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` |
| Instagram | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| X (Twitter) | `X_CLIENT_ID`, `X_CLIENT_SECRET` |
| YouTube | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` |
| WhatsApp | `WHATSAPP_APP_ID`, `WHATSAPP_APP_SECRET` |

All six OAuth callback controllers (`*-oauth-callback.controller.ts`) also read `PUBLIC_APP_URL`
(already listed under Core) to build the redirect URI.

### AI Video Studio export (Magic Hour)

| Setting | Notes |
|---|---|
| `VIDEO_EXPORT_ENABLED` | Defaults **off** (`"false"`/unset) — a deliberate 2026-09-19 decision: no paying clients yet, and the Magic Hour free tier's credits run out fast. Set to `"true"` once there's revenue to fund a paid plan. |
| `MAGIC_HOUR_API_KEY` | Required once the switch above is on. |
| `MAGIC_HOUR_MODEL` | Left unset on the free tier (`"kling-3.0"` is rejected with `plan_upgrade_required`, confirmed live). Set once upgraded. |
| `MAGIC_HOUR_RESOLUTION` | Same — free tier caps at 480p. |
| `MAGIC_HOUR_AUDIO` | Defaults `"false"` to conserve free-tier credits (audio costs ~1.5–2x more credits per render, confirmed not tier-gated). |

### Email campaigns

| Setting | Notes |
|---|---|
| `EMAIL_CAMPAIGN_BATCH_SIZE` | Defaults to `20` if unset/non-numeric. How many bulk-campaign emails `EmailCampaignsCronService` sends per minute-tick — kept low to stay under typical SMTP provider rate limits. |

### Error tracking (Sentry)

| Setting | Notes |
|---|---|
| `SENTRY_DSN` | Optional — `instrument.ts` skips `Sentry.init()` entirely if unset, same degrade-gracefully pattern as SMTP/storage. **Must be set as an Azure App Setting** for the backend to report errors in production (this is a runtime env var, not baked in at build time). Get it from the `campaignhub-backend` Sentry project's Settings → Client Keys. |

The frontend's equivalent, `NEXT_PUBLIC_SENTRY_DSN`, is a **build-time** variable — see below, not
an Azure App Setting.

### Not an App Setting — set programmatically

`API_PREFIX` is force-set to `"api"` by `combined-server.ts` itself before the app boots
(`process.env.API_PREFIX ||= 'api'`). It exists as a `ConfigService` read (`create-app.ts`,
`auth.controller.ts`) purely so `main.ts`'s local-dev entry point can leave it unset and get the
unprefixed API. Do not add this to Azure App Settings — setting it there would be redundant
with what the combined server already does.

## Frontend build-time variables

Two `NEXT_PUBLIC_*` variables are inlined into the client JavaScript bundle **at `next build`
time**, not read at request time — setting them as Azure App Settings after the fact has no
effect, they must be present in the CI build step's environment:

| Variable | Value in CI | Why |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `/api` | The combined server mounts the API under `/api` on the same origin as the frontend in production — a same-origin relative path, unlike local dev's separate-port URL. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Same OAuth Client ID as the backend's `GOOGLE_CLIENT_ID` | A public identifier by design (not a secret) — hardcoded directly in the workflow file rather than needing its own GitHub secret. |
| `NEXT_PUBLIC_SENTRY_DSN` | The `campaignhub-frontend` Sentry project's DSN | Same public-safe-identifier reasoning as above. |

Both are set as `env:` on the "Build frontend" step in
`.github/workflows/main_campaignhub-app2.yml` — see that file for the exact values.

## CI/CD pipeline

`.github/workflows/main_campaignhub-app2.yml`, triggered on push to the `rebuild` branch only
(not `main` — `main` is stale/diverged from what's actually deployed) or manually via
`workflow_dispatch`. One `build` job, one `deploy` job:

1. Install backend deps (`npm ci --legacy-peer-deps` — `@nestjs/throttler` hasn't published a
   peer range covering `@nestjs/core ^12` yet, even though it works fine at runtime against it),
   generate the Prisma client, run backend tests, build backend.
2. Install frontend deps, run frontend tests, build frontend (with the two `NEXT_PUBLIC_*`
   variables above).
3. **Apply database migrations** (`npx prisma migrate deploy`, using the `DATABASE_URL` repo
   secret) — runs only after both builds have already succeeded. This order matters: applying a
   migration ahead of an unbuildable release is what caused a past "No clients yet" production
   incident (the DB got a new shape the not-yet-deployed old code didn't expect).
4. Prune devDependencies from both `backend/node_modules` and `frontend/node_modules`
   (`npm prune --omit=dev`) and strip `dist/**/*.d.ts` / `dist/**/*.js.map` — none of it is
   needed to run `node dist/combined-server.js` or serve the built frontend.
5. Stage the deploy package (see layout below) and upload it as a build artifact.
6. `deploy` job downloads that artifact and runs `azure/webapps-deploy@v3` against the
   `campaignhub-app2` App Service `Production` slot, authenticated via the
   `AZURE_WEBAPP_PUBLISH_PROFILE` repo secret.

### What actually ships

```
deploy/
  backend/
    dist/            # compiled backend, .d.ts and .js.map stripped
    node_modules/     # pruned to production dependencies only
    package.json
    uploads/          # empty dir — local-disk fallback for BlobStorageService
  frontend/
    build-output/     # next build's output (distDir override, see Architecture above)
    node_modules/      # pruned to production dependencies only
    public/
    package.json
    next.config.ts
```

The Node process is started from inside `deploy/backend` via the startup command above;
`combined-server.ts` locates the sibling `frontend/` directory relative to its own compiled
file location (`dist/combined-server.js`), not `process.cwd()`, so this exact relative layout —
`backend/` and `frontend/` as siblings — must be preserved.

### Database secret

The `DATABASE_URL` GitHub Actions secret (used only by the migration step) and the App
Service's own `DATABASE_URL` App Setting (used by the running app) point at the same production
database, but are two separate places to update if the connection string or credentials ever
change — rotating one without the other will fail migrations or the app's own DB connection.
