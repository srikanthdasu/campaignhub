# CampaignHub AI — Production Release Handover

This document summarizes the state of CampaignHub AI's production system at the close of the
P0 through P2-25 production-readiness and hardening engagement. It exists so anyone picking
this project up — including a future version of whoever is reading this — can reconstruct
what was done, what was verified, what remains open, and what must not be touched without
going through the same controlled process this release followed.

## 1. Executive Summary

Production was audited end-to-end (P0/P1), hardened against nine confirmed post-release
findings (P2-1 through P2-9), reconciled against the full original finding set (P2-10),
patched for two non-breaking dependency advisories (P2-11), and released through a fully
controlled audit → commit → push → monitor → verify cycle (P2-12 through P2-24). A production
deployment race was discovered, investigated, and mitigated with GitHub Actions concurrency
protection (P2-17 through P2-23). Production is currently stable, serving commit `82ab8c4`,
with a small number of explicitly documented verification limitations — none of which are
production blockers.

## 2. Current Production Release

- Release commit: `82ab8c40226a816a640b8769c762afd40c3cee0d` (short: `82ab8c4`)
- Commit message: `ci: serialize production deployments`
- Parent commit: `c7382f16c2601791035250d80114ea608625a7c3` (short: `c7382f1`)
- `origin/rebuild`: `82ab8c4` — matches local `master` HEAD exactly
- Working tree: CLEAN
- Production target: Azure Web App `campaignhub-app2`, `Production` slot
- Live URL: `https://app.sreematechhub.com`
- Deployment result: SUCCESS

## 3. Production Verification

Verified read-only, post-deployment:

- Homepage (`https://app.sreematechhub.com/`): HTTP 200
- `/api/health`: HTTP 200, `{"status":"ok"}`
- Static assets (`_next/static/*` JS chunks, images): all HTTP 200
- Runtime/console: no errors beyond the expected anonymous `POST /api/auth/refresh → 401`
  (this 401 is correct, expected behavior for an unauthenticated request — not an error)
- Hydration: no errors observed

## 4. CI/CD Verification

- Workflow: `Build and deploy to Azure Web App - campaignhub-app2`
  (`.github/workflows/main_campaignhub-app2.yml`)
- Run: #89 (run ID `37495484741`)
- Result: SUCCESS, run attempt 1, no retries
- Backend unit tests: PASS
- Backend E2E tests: PASS
- Frontend tests: PASS
- Frontend build: PASS
- Production Prisma migration: PASS (no-op — this release introduced no new migration files)
- Deployment artifact creation/upload: PASS
- Azure deployment (`azure/webapps-deploy@v3`, OneDeploy): PASS
- Duplicate workflow runs for this commit: NONE (confirmed via the GitHub Actions API; exactly
  one run exists for `82ab8c4`)

## 5. Security & Hardening Completed

- **P0-1** — Next.js critical RCE patched (`^16.3.3` → `^16.3.8`, both backend and frontend)
- **P1-1** — Email campaign cron duplicate-send protection (atomic claim pattern)
- **P1-2** — Client purge / ApprovalFlow deletion race fixed with a transaction
- **P1-3** — Razorpay startup environment validation added
- **P1-4** — CORS and Azure Storage configuration verified against live production
- **P1-5** — Safe `npm audit fix` remediation within existing semver ranges
- **P1-6** — Social OAuth reconnect UX for expired/invalid tokens
- **P2-1** — Password reset: password update + refresh-token revocation now share one transaction
- **P2-2** — Approval decision: step/flow/content status writes now share one transaction
- **P2-3** — Bulk email recipient import: JSON/urlencoded body limit raised 100KB → 2MB
  (non-breaking bootstrap fix; a prior attempt that used the wrong method signature was caught
  and corrected via the accompanying e2e test before being verified)
- **P2-4** — Magic Hour (AI video) create/poll/download requests bounded with `AbortSignal.timeout()`
- **P2-5** — Azure Blob and local-disk media-delete failures now logged (warn-level, message-only,
  verified to never leak Authorization headers, SAS tokens, or account keys)
- **P2-6** — Production rollback runbook authored (`docs/ROLLBACK_RUNBOOK.md`)
- **P2-7** — ClientAccessGuard `:id` fallback reviewed — confirmed required by two live routes, not
  dead code, no change made
- **P2-8** — `API_PREFIX` / Magic Hour documentation reviewed — confirmed accurate, no gap found
- **P2-9** — Frontend `RequireRole` coverage reviewed — the 7 flagged pages confirmed intentionally
  multi-role by backend design; no frontend change made
- **P2-10** — Full reconciliation of every original P2/P3 finding against current code
- **P2-11** — Non-breaking dependency fixes: `proxy-addr` 2.0.7→2.0.8 (critical), `source-map-js`
  1.2.1→1.2.2 (high, both backend and frontend); Prisma deliberately left at `7.10.0`
- **P2-12** — Final release-candidate audit of the full accumulated changeset
- **P2-13 / P2-14** — Controlled staging, review, and commit of the verified release (`7c19261` → `c7382f1`)
- **P2-17 / P2-18** — Investigated and verified a production deployment collision (see §6)
- **P2-19** — Reviewed and designed GitHub Actions concurrency protection
- **P2-20** — Implemented the approved concurrency block
- **P2-21** — Controlled commit of the concurrency change (`82ab8c4`)
- **P2-22** — Pre-push verification of that commit
- **P2-23** — Production deployment of `82ab8c4`, monitored end-to-end
- **P2-24** — Final production closure verification

## 6. Deployment Concurrency Protection

The workflow now contains:

```yaml
concurrency:
  group: campaignhub-app2-production-deploy
  cancel-in-progress: false
```

What this means operationally:
- Production-deploying runs of this workflow now serialize — only one can be actively running
  (build or deploy) at a time.
- An active deployment is never cancelled mid-flight; a second run waits instead.
- A second workflow run can no longer race the active Production deployment within this workflow.
- The previous `OneDeploy 400` collision (release `c7382f1`, run #88, which failed while run #87
  was still actively deploying the same commit) is **mitigated** by this protection — confirmed by
  `82ab8c4`'s own deployment (run #89) completing as the sole run, with no recurrence.

**Important caveat, stated precisely:** the *original* duplicate-trigger root cause — why two
workflow runs were created from what appeared to be a single push — remains **PROBABLE BUT NOT
PROVEN**. The most likely explanation (a single push's webhook delivery firing twice) was never
independently confirmed, since that requires GitHub repository-admin access to the webhook
delivery log, which was not available during this engagement. Concurrency protection prevents
the *consequence* (a race against Production) regardless of the *cause*; it does not explain the
cause itself.

## 7. Backup & Recovery

A full backup was taken and verified present prior to this release work:

- Backup name: `CampaignHub_AI_FULL_BACKUP_20261005_183855`
- Location: `E:\CampaignHub-AI-Rebuild_BACKUPS\CampaignHub_AI_FULL_BACKUP_20261005_183855\`
- Verified contents at the time of the backup: source code, a PostgreSQL database dump, uploaded
  media files, a Git bundle, and checksums for the above — all confirmed present and intact by
  directory inspection.
- **Not tested:** an actual isolated restore (database or full environment) was not performed or
  rehearsed as part of this engagement — only the backup's presence and structural completeness
  were verified. Treat a real restore as unrehearsed until it is.

For rollback guidance, see **`docs/ROLLBACK_RUNBOOK.md`** — it documents the current deployment
model, the forward-only Prisma migration constraint, a concrete example of a destructive migration
already in this project's history, and the manual verification steps to run after any rollback.
This handover document does not duplicate that content.

## 8. Known Limitations

These are documented, accepted verification gaps — not production incidents:

1. **Azure Storage remains independently unverified.** `AZURE_STORAGE_CONNECTION_STRING`, the
   production storage account, and the `media` container's existence/configuration were never
   confirmed via an authenticated Azure session during this engagement (no Azure CLI, PowerShell,
   or Portal access was available).
2. **Production runtime exposes no commit/version endpoint.** There is no way to directly ask the
   running application which commit it's serving. Confidence that `82ab8c4` is live rests entirely
   on GitHub Actions' own authoritative job-success record (run #89), not on anything the app itself
   reports.
3. **Azure Deployment Center / Kudu deployment history remains independently unverified**, for the
   same tooling-access reason as (1).
4. **The original duplicate-trigger root cause (§6) remains unproven**, mitigated but not explained.

## 9. Deferred Hardening

Real findings, intentionally left for a future, separate phase — not blockers:

- **AI spend-cap guard** (`AiSpendCapGuard`) has a non-atomic count-then-create race and can
  overcount requests whose downstream AI call later fails. Accepted: the guard is explicitly an
  "emergency backstop," not a billing-accuracy mechanism, and the overcounting only makes it trigger
  *earlier*, never later.
- **`mysql2` and `deepmerge-ts` dependency advisories** (both transitive via the `prisma` CLI
  package) have no non-breaking fix — remediation requires a Prisma downgrade from `7.10.0` to
  `6.19.3`, deliberately not performed.
- **OAuth callback endpoints** rely only on the global default rate limit (60/min/IP) rather than
  a dedicated tighter throttle like the one applied to `auth.controller.ts`'s routes.
- **Prisma connection-pool sizing** has no explicit configuration — relies entirely on
  `@prisma/adapter-pg` defaults; a capacity-planning decision, not a bug.
- **`braces` dev-tooling advisory** (frontend, via `eslint-config-next`'s lint-only dependency
  chain) — dev-only, no non-breaking fix path, not shipped to production.

## 10. Operational Rules — Do Not Change Without New Review

The following must not be modified except through the same audit → approval → implementation →
verification → commit → explicit push process this release followed:

- The production workflow (`.github/workflows/main_campaignhub-app2.yml`)
- The production (`rebuild`-deployed) database, and anything touching Prisma migrations
- The Azure `campaignhub-app2` Production slot and its configuration
- The `concurrency` settings documented in §6
- Production secrets (`AZURE_WEBAPP_PUBLISH_PROFILE`, `DATABASE_URL`, and all other Azure App
  Settings)
- Azure Storage configuration
- The `rebuild` branch itself — pushing to it is the production deployment trigger; there is no
  separate staging gate

## 11. Future Verification

**A. Verification-only** (no code change required):
- Confirm Azure Storage configuration directly via the Azure Portal or CLI when access is available
- Confirm Azure Deployment Center / Kudu history directly, same access requirement
- Optionally decide whether a lightweight production version/commit identification mechanism is
  worth adding — not currently a blocker, purely a future convenience

**B. Hardening** (deferred, tracked in §9):
- The dependency advisories tied to a Prisma major-version decision
- OAuth callback throttling
- Prisma connection-pool configuration
- Any other item listed in §9

**C. Feature/product work:**
Normal product development can continue independently of the above, provided any change touching
the items in §10 goes through the same controlled process, and provided any change to
`backend/prisma/migrations` is evaluated against the forward-only, no-rollback constraint
documented in `docs/ROLLBACK_RUNBOOK.md`.

## 12. Final Status

```
PRODUCTION STATUS:     STABLE
RELEASE STATUS:        CLOSED WITH DOCUMENTED LIMITATIONS
CURRENT RELEASE:       82ab8c4
DEPLOYMENT:            SUCCESSFUL
IMMEDIATE ACTION:      NONE
```
