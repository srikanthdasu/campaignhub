# Schema & design decisions

Facts about the data model that are easy to get wrong from the code alone — surfaced here so
they're a lookup instead of a forensic exercise. Add to this file when a schema decision needs
this kind of "review checklist" flag rather than a one-time code fix.

## Two role vocabularies — `Role` and `ClientGroupRole`

`prisma/schema.prisma` defines two separate, unrelated role enums:

- **`Role`** (`OWNER, ADMIN, MANAGER, CREATOR, DESIGNER, ANALYST, CLIENT, SUPER_ADMIN`) — the
  user's agency-wide role, stored on `User.role`. Checked by `RolesGuard`/`@Roles(...)` on
  controllers.
- **`ClientGroupRole`** (`MANAGER, APPROVER, VIEWER`) — a per-client-relationship role, stored on
  `UserClientAccess.role`. Scopes what a non-agency-wide user can do for one specific client.

**`MANAGER` is a valid value in both enums and means something different in each** — an agency-wide
staff role in one, a specific client-access grant level in the other. There's no code fix for
this (they're deliberately distinct concepts); the discipline is reading `role === 'MANAGER'` at
any call site and checking *which* enum it's typed against before trusting what it implies.
Reviewer checklist: when a PR touches role checks, confirm which enum is in scope.

## Soft-delete: what's actually guaranteed

**Only `Client` has real soft-delete.** `Client.deletedAt` (nullable `DateTime`) plus the lifecycle
in `clients.service.ts`:

- `softDelete()` sets `deletedAt`; `restore()` clears it. Recoverable in between.
- `ClientsCronService` runs daily: `warnBeforePurge()` notifies the agency's Owners/Admins
  `WARNING_DAYS_BEFORE_PURGE` (3) days before the cutoff; `purgeExpired()` hard-deletes any client
  past `GRACE_PERIOD_DAYS` (15) days soft-deleted.
- **The hard-delete cascades.** Every model that references `Client` in `schema.prisma` uses
  `onDelete: Cascade` (content items, campaigns, ads, media assets, scheduled posts, approvals,
  inbox messages, invoices' `subscriptionId` link, etc.) — the promise is a 15-day recovery window
  on the *Client* row, not on the client's data individually, and nothing about the cascade is
  reversible once it fires. There's no "restore a purged client" path.

**Nothing else in the schema has `deletedAt`.** `User.isActive` (`Boolean`, no timestamp) is
deactivation, not soft-delete — no grace window, no restore-from-deleted-list UI, no purge job. It
just gates login/access while the row stays intact indefinitely. Every other model (campaigns,
content, media, etc.) is a plain hard delete the moment its parent is removed, or via its own
explicit `DELETE` endpoint — no recovery window at all.

Reviewer checklist: don't assume a new "delete" feature gets a grace period or is recoverable
unless it explicitly reimplements the `Client` pattern — the default in this codebase is
irreversible.

## DB-1 — three models with no direct tenant column

Correction: this was previously marked "not reconstructed" in this file — the original audit
artifact wasn't in the repo, but it was later found outside it. Recording the real finding here now.

**`ApprovalStep`, `EmailRecipient`, and `AiMessage` have no `clientId`/`agencyId` column of their
own.** Their tenant is only reachable by walking the parent chain:

- `ApprovalStep` → `approvalFlowId` → `ApprovalFlow.contentItemId` → `ContentItem.clientId` →
  `Client.agencyId` (3 hops).
- `EmailRecipient` (holds real PII — names and email addresses) and `AiMessage` (raw LLM
  conversation content) are each 2 hops indirect.

**Why it matters:** any future query written as `findMany({ where: { approvalFlowId } })` or
`{ where: { conversationId } }` without re-deriving the parent chain's tenant is a silent
cross-tenant read. `ApprovalStep` additionally has `@@index([approverId])` — a fast index that
would make exactly this mistake perform *well*, so it wouldn't surface in slow-query monitoring
either.

**Not a bug today** — the audit itself confirmed the app-layer checks are in fact present via the
`requireInClient`-style helpers this codebase already uses consistently. This is a schema-shape
risk, not a live vulnerability, and not something a migration fixes on its own (adding a
denormalized `clientId` to all three would work, but is a real migration + backfill, not a
one-line change). Reviewer checklist: any new query against these three tables must confirm it
re-derives tenant scope through the chain before trusting request-supplied ids.
