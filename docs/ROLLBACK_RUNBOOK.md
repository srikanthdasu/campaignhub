# Production Rollback Runbook

## 1. Purpose

This document describes safe recovery considerations for a failed or problematic
CampaignHub AI production release. It is a **manual operational runbook** — nothing here is
automated, and none of the steps below run on their own. It exists so a rollback decision
during an incident is made from documented facts, not from assumptions about capabilities
(an automatic rollback, a staging slot, a one-click Azure redeploy) that this project may not
actually have.

## 2. Current Deployment Model

Confirmed from [`.github/workflows/main_campaignhub-app2.yml`](../.github/workflows/main_campaignhub-app2.yml):

- Pushing to the **`rebuild`** branch triggers deployment automatically. There is no GitHub
  Environment approval gate — a successful push is all it takes.
- The workflow deploys to Azure Web App **`campaignhub-app2`**, slot **`Production`**. This
  is the only slot the workflow references anywhere.
- Before any deployment, the workflow runs backend unit tests (with a coverage gate), backend
  e2e tests (against an ephemeral CI database), a backend build, frontend tests, and a
  frontend build. Deployment only proceeds if all of these pass.
- The workflow runs `npx prisma migrate deploy` **against the real production database**
  (`secrets.DATABASE_URL`) after the builds succeed but before the Azure deploy step runs.
- The workflow has **no automatic rollback** of any kind, and **no post-deployment health
  check** — it does not call `/api/health` or verify the app is actually serving traffic
  after `azure/webapps-deploy@v3` completes. Success is just "the deploy action didn't
  error."

A staging slot does **not** currently exist in this configuration — see §8 for what is and
isn't verified about Azure itself.

## 3. First Response

Before attempting any rollback:

1. Confirm the affected release/commit — check `origin/rebuild`'s current commit against the
   last known-good one.
2. Check application health: `GET https://app.sreematechhub.com/api/health`.
3. Check application logs/monitoring (Sentry, Azure App Service logs) for the actual error.
4. Determine whether the issue is **application-only** or **schema-related**.
5. Determine whether a Prisma migration ran as part of the problematic release (check the
   release's diff for `backend/prisma/migrations/`).
6. Identify the previous known-good commit.
7. **Do NOT** immediately reset or force-push `rebuild`.
8. **Do NOT** manually modify the production database schema.

## 4. Decision: Is Application Rollback Safe?

### SAFE-TO-CONSIDER CASE

Rolling application code back can be considered when:

- the problematic release did **not** introduce a database migration, **or**
- the database schema remains backward-compatible with the previous application version
  (the old code's queries still work against the current schema).

### UNSAFE CASE — do not blindly roll back

**Do NOT** roll application code back when the release already applied a destructive or
incompatible Prisma migration — one that removed columns/tables the old application code
still expects, or otherwise changed the schema in a way the previous version can't handle.

**Concrete example from this repository's own history:**
migration `20260924003000_pending_findings_cleanup` drops:

- `agencies.plan`
- `agencies.subscription_status`

An application version from before that migration ran would query/write those columns and
fail once they're gone. This is not a hypothetical — it's the shape of migration this project
has actually shipped before, and the same risk applies to any future migration that drops or
renames a column/table.

## 5. Important Prisma Rule

Prisma migrations in this project are **forward-only**. There are no `down.sql` or equivalent
rollback migrations anywhere in `backend/prisma/migrations/` (37 migration folders, none of
them reversible).

**Do NOT** manually delete or edit migration history. **Do NOT** hand-write a "reverse"
migration and apply it to production during an incident. **Do NOT** manually
`ALTER TABLE`/`DROP`/edit the production schema outside Prisma's own migration flow.

If the schema is already incompatible with the previous application version, the safer path
is almost always to **fix forward** — ship a new, small, corrective release — rather than
trying to force the database backward. If an actual database-level recovery is genuinely
required (e.g. restoring from a backup), that needs its own separately reviewed procedure —
it is out of scope for this runbook.

## 6. Application Rollback Procedure

Only follow this once §4 has established that rollback is actually safe.

1. Identify the last known-good commit (via `git log` on `rebuild`, or this project's own
   release history).
2. Confirm that commit's application code is compatible with the **current** production
   schema — not the schema at the time that commit was originally deployed. If any migration
   has landed since, re-check §4.
3. **Do NOT** force-push or rewrite shared Git history to "undo" commits.
4. If rollback is confirmed safe, deploy the verified known-good commit through the existing
   `rebuild` mechanism (e.g. a revert commit, or fast-forwarding `rebuild` to point at that
   commit via a normal push) — the same way any other release reaches production.
5. Understand that this re-runs the **entire** CI/CD pipeline from scratch (tests, both
   builds, the production migration step, then deploy) — it is not an instant rollback, and
   takes as long as any other deployment.
6. Wait for the test/build gates to pass before deployment proceeds.
7. Monitor the resulting deployment in GitHub Actions.
8. **Manually verify `/api/health` returns HTTP 200 after deployment** — the workflow does
   not do this for you (see §2).
9. Manually verify key application functionality (login, core pages load, no new console/API
   errors).
10. Document the incident per §10.

**Do not** provide or follow instructions that reset or force-push the `rebuild` branch.
**Do not** bypass the CI/CD pipeline to deploy faster.

## 7. If a Destructive Migration Already Ran

> **STOP before rolling application code backward.**

Determine:

- the migration's name and timestamp
- exactly what schema changes it made
- whether the previous application version actually depends on what changed

If the previous version is **incompatible** with the current schema:

- do **not** blindly deploy the old code
- do **not** manually reverse the schema changes
- preserve the current database state as-is
- investigate a forward fix, or escalate to a separately approved database recovery
  procedure — do not improvise one during the incident

## 8. Azure Slot / Deployment-History Limitation

**CONFIRMED** (from repository configuration): the workflow deploys to Production only. A
staging slot is not referenced anywhere in `.github/workflows/main_campaignhub-app2.yml` or
elsewhere in this repository.

**NOT independently verified**: whether a staging slot exists on the Azure side outside what
this workflow controls, and whether Azure's own deployment-history "redeploy a previous
build" feature is available/usable for this App Service. Neither was confirmed during the
review this runbook is based on (no Azure CLI/PowerShell/MCP tooling or authenticated Portal
session was available in that environment).

This runbook must **not** be read as claiming that a staging slot or a one-click Azure
rollback exists, nor that it definitely doesn't. If Azure Portal access is available during a
real incident, an operator may independently check the Deployment Center / deployment history
for `campaignhub-app2` and use whatever is actually there — just don't assume it ahead of
time.

## 9. Post-Rollback Verification

Because the workflow has no automated post-deployment health check, verify manually:

- `/api/health` returns HTTP 200
- the application starts successfully (no crash-loop in App Service logs)
- the frontend loads
- authentication works (login succeeds)
- critical API paths respond correctly for the areas affected by the incident
- no new startup/runtime errors appear in logs or Sentry
- monitoring/logs have been reviewed for the period right after deployment

## 10. Incident Documentation

Record for every rollback (successful or not):

- incident time
- affected release commit
- previous known-good commit
- whether a Prisma migration ran as part of the affected release
- migration name(s), if applicable
- rollback decision (rolled back / fixed forward / other) and why
- reason the rollback was considered safe (or why it wasn't attempted)
- deployment result
- health-check result
- remaining issues
- follow-up actions
