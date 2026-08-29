# Old CampaignHub App — Reference Notes

This is a summary of the previous CampaignHub AI app, for reference only. **This is not being extended — it's being fully rewritten.** These notes exist so Claude Code understands what worked, what didn't, and what not to repeat.

## Old Stack
- Express.js (plain, not modular), session-based auth (`express-session`, `bcryptjs`)
- PostgreSQL (`pg`), no migration tool — schema changed via manually-triggered GET endpoints (e.g. `/create-users-table`)
- Static HTML/CSS/JS frontend, no framework, no bundler
- AI: Azure AI Foundry + OpenAI SDK (captions, images), Google Veo 3.1 via Vertex AI + Google Cloud Storage (video)
- PDFKit + ExcelJS for report exports
- No git — version history was kept as manually-renamed backup folders and `.BEFORE-*` duplicate files instead of commits

## What Worked (useful as behavioral/logic reference, not to copy structurally)
- AI caption generation flow (prompt → Azure Foundry call → save → notify user)
- AI image generation with basic per-plan limits
- AI Video Studio: real integration with Veo 3.1 (`veoProvider.js`), polling for job completion, storing output to GCS — this logic is a good reference for the new `VideoProvider` abstraction
- PDF/Excel report export logic
- Basic notification system

## What's Missing (confirms need for full rewrite)
- No multi-tenancy — one flat `users` table, no Agency → Client hierarchy
- No RBAC — no distinct roles (Owner/Admin/Manager/Creator/Designer/Analyst/Client)
- No Approval Workflow
- No real social platform publishing — scheduler just tracks a status field, nothing actually posts anywhere
- No Campaigns, Brand Kit, Client Portal, Social Accounts management, AI Strategy & Governance, Ads, Team Operations, Security & Audit, Operational Architecture
- "Subscription plans" (SILVER/GOLD/PLATINUM) exist only as a gating flag on the `users` table — **no real payment processor**, no Stripe, nothing that actually charges anyone

## Known Issue — Do Not Repeat
`server.js` has two unauthenticated debug routes still present in the most recent backup:
- `GET /debug/users` — returns every user's id, name, email, and password hash
- `GET /debug/reset-password` — resets a hardcoded test account's password

These should never exist in the new app, even temporarily during development. If the old app is still deployed live on Azure, this is worth patching or taking offline independent of the rewrite timeline.

## Process Issue — Do Not Repeat
No git repository was used. Instead, the project accumulated 15+ manually-named backup folders (e.g. `BEFORE_ROLLBACK`, `CHECK_2PM50_ZIP`, `public_BEFORE_LIVE_UI_FINAL_20260820`) and individual files duplicated with suffixes like `.BEFORE-subscription.js`, `dashboard.html.BEFORE_LOGO_FIX_20260824`. This made simple changes (like a logo update) slow and risky, since there was no reliable way to branch or roll back safely. **Use Git with proper commits and branches from the very first file created in the new project.**

## Files Worth Referencing During Rebuild
From the old backup, these show working logic patterns worth reading before reimplementing equivalent features:
- `services/videoProviders/veoProvider.js` — Veo integration pattern
- `services/aiService.js`, `services/promptService.js` — AI caption/prompt logic
- `middleware/subscription.js` — shows the *intent* of plan gating (SILVER/GOLD/PLATINUM), even though it has no real billing behind it
- `controllers/schedulerController.js` — shows what scheduling UI expects, even though actual publishing was never implemented
