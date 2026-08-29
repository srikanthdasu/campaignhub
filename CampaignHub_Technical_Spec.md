# CampaignHub AI — Technical Specification (v1)
**For: full rewrite of CampaignHub AI (39-module platform)**
**Prepared from: product book v5 (39 modules), old app codebase, backup history, and stack decisions confirmed in planning chat.**

---

## 0. Note on Source Review

This spec is based on the product book text **and** a direct review of the 37 workflow diagram images (`workflow_reference/*.png`) in the v5 book package, plus the old app's code and backup history. The diagrams surfaced several concrete details not visible from the text alone (platform list, billing gateways, AI Video Studio's full feature set) — these are reflected below and take priority over earlier assumptions in this document's history.

## 1. Confirmed Decisions

| Area | Decision |
|---|---|
| Scope | Full 39-module platform (see Section 6), built in phased order, not literally in parallel |
| Hosting | Microsoft Azure (existing credits/account) — **new** resource group, App Service/Container App, and Postgres instance, separate from the old app's resources |
| Database | Azure Database for PostgreSQL Flexible Server (fresh instance, not the old one) |
| Backend | Node.js + **NestJS** (TypeScript) — replaces old plain Express, gives modular structure matching the 39 modules |
| Frontend | Next.js + TypeScript + Tailwind — replaces old static HTML/CSS/JS pages |
| Cache/Queue | Azure Cache for Redis + BullMQ (scheduling, publishing, AI job queues) |
| Media storage | Azure Blob Storage |
| Text/reasoning AI | Claude API (captions, AI Assistant, AI Strategy & Governance module) |
| Video AI | **Provider-abstraction layer** — Google Veo (Vertex AI) and a self-hosted open video model on NVIDIA GPU credits (Azure NC/ND VMs or Nebius) both implement the same interface; which one is "default" is decided later once GCP credit eligibility for Veo is confirmed |
| GPU workloads | NVIDIA credits via Azure NC/ND-series VMs (primary); Nebius ($150k GPU savings) as a larger-capacity option to evaluate |
| Auth | Azure AD B2C or Auth.js, backed by a custom RBAC table (see Section 4) |
| Market | **India-first.** Confirmed from the product book's own workflow diagrams (pricing in ₹, GST invoicing, Razorpay/UPI/Paytm shown as primary payment methods) |
| Billing | **Razorpay** as primary gateway (native UPI + GST invoicing support). Stripe/PayPal optional for international clients later. The old app only had a `plan` column with no real payment processing — this needs to be built from scratch either way |
| Data migration | Not decided yet — old Postgres DB is kept untouched as a reference; migration scripts can be written later once new schema is stable |
| Version control | **Git from day one.** The old project had no git — instead 15+ manually-named backup folders (`BEFORE_ROLLBACK`, `CHECK_2PM50_ZIP`, etc.) and duplicated files (`file.BEFORE-fix.js`). This is the single biggest process fix for this rebuild. |

---

## 2. What Exists in the Old App (from code review)

**Stack:** Express (not modular), session auth, PostgreSQL, static HTML/CSS/JS, PDFKit/ExcelJS exports, Azure AI Foundry + OpenAI SDK for captions/images, Google Veo 3.1 via Vertex AI + GCS for video.

**Working / partially working:**
- Auth (login/register) — flat `users` table, no roles, no tenancy
- AI Captions (via Azure Foundry)
- AI Images (via Azure Foundry, with basic per-plan limits)
- AI Video Studio — real backend, calls Veo 3.1, stores to GCS
- Content Planner — plan stored as a single JSONB blob (no structured querying)
- Scheduler — has a status field but **no real publish-to-platform integration** (nothing actually posts to social platforms)
- Analytics, Reports (PDF/Excel export)
- Notifications, Admin, Profile — basic CRUD
- Subscription plans (SILVER/GOLD/PLATINUM) — **gating logic only, no real payment processor**

**Missing entirely:**
- Multi-tenancy (Agencies → Clients)
- RBAC (Owner/Admin/Manager/Creator/Designer/Analyst/Client roles)
- Approval Workflow
- Real social platform publishing (Meta, LinkedIn, X, TikTok, YouTube)
- Campaigns, Brand Kit, Client Portal, Social Accounts & Integrations, AI Strategy & Governance, Ads, Members & Team Ops, Security & Audit, Operational Architecture

**Known security issue to NOT repeat:** the old `server.js` exposes unauthenticated `/debug/users` (lists all users) and `/debug/reset-password` (resets any password to a fixed value). Do not carry this pattern forward; if the old app is still live, this should be patched or taken down independent of the rewrite.

---

## 3. Database Schema (Core Tables)

```sql
-- Tenancy
CREATE TABLE agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    plan VARCHAR(30) DEFAULT 'SILVER',
    subscription_status VARCHAR(30) DEFAULT 'TRIAL',
    stripe_customer_id TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    brand_kit_id UUID,
    created_at TIMESTAMP DEFAULT now()
);

-- Users & RBAC
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name VARCHAR(150) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'CREATOR', -- OWNER, ADMIN, MANAGER, CREATOR, DESIGNER, ANALYST, CLIENT
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE user_client_access (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, client_id)
);

-- Brand Kit
CREATE TABLE brand_kits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    logo_url TEXT,
    primary_color VARCHAR(20),
    secondary_color VARCHAR(20),
    fonts JSONB,
    voice_guidelines TEXT,
    created_at TIMESTAMP DEFAULT now()
);

-- Campaigns & Content
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    goal TEXT,
    start_date DATE,
    end_date DATE,
    status VARCHAR(30) DEFAULT 'DRAFT',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE content_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL, -- CAPTION, IMAGE, VIDEO, POST
    body TEXT,
    media_asset_id UUID,
    platform VARCHAR(50),
    ai_generated BOOLEAN DEFAULT false,
    status VARCHAR(30) DEFAULT 'DRAFT', -- DRAFT, IN_REVIEW, APPROVED, SCHEDULED, PUBLISHED, REJECTED
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT now()
);

-- Approval stages per the workflow diagram: SUBMITTED -> NOTIFIED -> IN_REVIEW ->
-- (CHANGES_REQUESTED -> RE_SUBMITTED ->) IN_REVIEW -> APPROVED -> COMPLETED
CREATE TABLE approval_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    mode VARCHAR(20) NOT NULL DEFAULT 'SEQUENTIAL', -- SEQUENTIAL or PARALLEL
    due_date TIMESTAMP,
    status VARCHAR(30) DEFAULT 'SUBMITTED',
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE approval_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_flow_id UUID NOT NULL REFERENCES approval_flows(id) ON DELETE CASCADE,
    approver_id UUID REFERENCES users(id),
    step_order INTEGER, -- used when mode = SEQUENTIAL
    decision VARCHAR(30) DEFAULT 'PENDING', -- PENDING, APPROVED, CHANGES_REQUESTED, REJECTED
    comment TEXT,
    decided_at TIMESTAMP
);

-- Media
CREATE TABLE media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- IMAGE, VIDEO
    storage_url TEXT NOT NULL,
    ai_provider VARCHAR(30), -- e.g. 'veo', 'self-hosted', 'claude', null if uploaded manually
    prompt TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT now()
);

-- Scheduling & Publishing
CREATE TABLE social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    platform VARCHAR(30) NOT NULL, -- META, LINKEDIN, X, TIKTOK, YOUTUBE
    external_account_id TEXT,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    connected_by UUID REFERENCES users(id),
    connected_at TIMESTAMP DEFAULT now()
);

CREATE TABLE scheduled_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    social_account_id UUID REFERENCES social_accounts(id),
    scheduled_time TIMESTAMP NOT NULL,
    status VARCHAR(30) DEFAULT 'PENDING', -- PENDING, PUBLISHING, PUBLISHED, FAILED
    published_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT now()
);

-- Engagement
CREATE TABLE inbox_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    social_account_id UUID REFERENCES social_accounts(id),
    platform VARCHAR(30),
    sender_name TEXT,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    received_at TIMESTAMP DEFAULT now()
);

-- Billing (Razorpay primary, GST-aware)
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    razorpay_subscription_id TEXT,
    plan VARCHAR(30) NOT NULL, -- STARTER, GROWTH, ENTERPRISE (per the product book's plan tiers)
    status VARCHAR(30) NOT NULL, -- TRIAL, ACTIVE, PAST_DUE, CANCELLED, EXPIRED, PAUSED
    billing_cycle VARCHAR(20) DEFAULT 'MONTHLY',
    current_period_end TIMESTAMP
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id),
    amount NUMERIC(10,2) NOT NULL,
    gst_amount NUMERIC(10,2) DEFAULT 0,
    gst_number TEXT,
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(20) DEFAULT 'ISSUED', -- ISSUED, PAID, OVERDUE
    invoice_pdf_url TEXT,
    issued_at TIMESTAMP DEFAULT now()
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT now()
);

-- Audit
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT now()
);
```

Use a real migration tool (Prisma migrate or Knex migrations) from the first commit — no ad-hoc `ALTER TABLE` scripts run manually, which is how the old app's schema drifted.

---

## 4. RBAC Permission Matrix

| Role | Scope | Content | Approvals | Publishing | Billing | Client Portal | Admin/Settings |
|---|---|---|---|---|---|---|---|
| Owner | Whole agency | Full | Full | Full | Full | Full | Full |
| Admin | Whole agency | Full | Full | Full | View | Full | Full (no billing changes) |
| Manager | Assigned clients | Full | Approve/Reject | Full | — | View | — |
| Creator | Assigned clients | Create/Edit own | Submit for review | — | — | — | — |
| Designer | Assigned clients | Create/Edit media | Submit for review | — | — | — | — |
| Analyst | Assigned clients | View | — | — | — | — | View reports only |
| Client | Own client only | View/Comment | Approve/Reject own content | — | View own invoices | Full (their own portal) | — |

Enforce this server-side via a NestJS guard checking `role` + `user_client_access`, never in the frontend alone.

---

## 5. AI Video Studio — Full Scope + Provider Abstraction

**Important scope correction:** the workflow diagram shows AI Video Studio as an 8-step pipeline (Idea/Input → Script → Scene Builder/Storyboard → Media & Assets → Edit & Enhance → Preview → Export → Publish) with AI script writing, a stock media library, AI voiceover, auto-captions in 100+ languages, and multi-platform export presets. The old app only implements a single-shot "prompt + reference image → Veo video" call — this is a small fraction of the intended module. Plan Phase 4 (AI layer) build time accordingly; this is one of the largest single modules in the platform, not a thin wrapper around Veo.

**Generation provider abstraction (the actual video-rendering step within the pipeline):**

```
interface VideoProvider {
  generate(prompt: string, referenceImage?: string, options: VideoOptions): Promise<VideoJob>;
  checkStatus(jobId: string): Promise<VideoJobStatus>;
}
```

Implementations:
- `VeoProvider` — wraps the existing `veoProvider.js` logic (Vertex AI, Veo 3.1, GCS storage) from the old app; reuse as reference, rewritten to fit the new module structure
- `SelfHostedProvider` — runs an open video generation model on Azure NC/ND GPU VMs (or Nebius), exposed via an internal API

The AI Video Studio module calls the interface, not a specific provider — which one is active is a config setting per agency/plan, decided once Google Cloud credit eligibility for Veo is confirmed. Script generation and captioning (100+ languages) are separate sub-features that can use Claude, not the video provider.

---

## 6. Module List (39 modules, build order)

**Phase 1 — Foundation:** Auth, RBAC, Agency/Client Setup, Profile, Settings, Security & Audit
**Phase 2 — Core content loop:** Content Creation, Media Library, Brand Kit, Content Planner, Approval Workflow, Scheduler, Publishing
**Phase 3 — Social integrations:** Social Accounts & Integrations, Social Platforms, Unified Inbox (register OAuth apps with each platform early — approval can take days/weeks)
**Phase 4 — AI layer:** AI Assistant, AI Captions, AI Video Studio, AI Strategy & Governance
**Phase 5 — Campaigns & Ads:** Campaigns, Ads & Paid Campaigns
**Phase 6 — Insight & business layer:** Analytics, Reports, Notifications, Billing & Subscriptions (Stripe), Members & Team Operations, Client Portal
**Phase 7 — Operational polish:** Supporting Systems, Operational Architecture, end-to-end QA, Future Roadmap items

Full module descriptions/workflows are in the product book (v5, 39-chapter edition) — use it as the UX/behavior reference; this spec is the technical layer underneath it.

---

## 7. Integrations Needed (register credentials early)

| Service | Purpose | Notes |
|---|---|---|
| Meta Graph API | Facebook/Instagram publishing | OAuth app review takes time |
| LinkedIn API | LinkedIn publishing | |
| X API | X/Twitter publishing | |
| TikTok for Developers | TikTok publishing | Confirmed in workflow diagrams |
| YouTube Data API | YouTube publishing | |
| Pinterest API | Pinterest publishing | Confirmed in workflow diagrams — was missing from earlier draft |
| WhatsApp Business API | WhatsApp publishing/messaging | Confirmed in workflow diagrams — was missing from earlier draft |
| Anthropic API (Claude) | Captions, AI Assistant, AI Strategy & Governance, video script writing | |
| Google Vertex AI (Veo) | Video generation — pending GCP credit eligibility confirmation | |
| Razorpay | Billing & Subscriptions (primary) — UPI, cards, native GST invoicing | Not present at all in old app |
| Stripe / PayPal | International billing (secondary, later) | |
| Slack / Microsoft Teams | Approval & notification alerts | Shown in Approvals workflow diagram |
| Google Drive / Dropbox | Asset import/export in Approvals & Media Library | Shown in Approvals workflow diagram |
| Azure Blob Storage | Media storage | |
| Azure Database for PostgreSQL | Primary DB | |
| Azure Cache for Redis | Queues, scheduling | |

---

## 8. Security Fixes Required (do not repeat old app's mistakes)

1. No debug/admin endpoints without auth — old app's `/debug/users` and `/debug/reset-password` must not exist in the new app
2. All queries scoped by `agency_id`/`client_id` — no flat unscoped `users`/`content` tables
3. Encrypt social platform tokens at rest (`access_token_encrypted` columns above)
4. Real migrations tool — no runtime `ALTER TABLE` via GET endpoints
5. Git from commit #1 — no manual `.BEFORE-*` file duplication as a substitute for version control
