// Shared @Throttle() overrides layered on top of the global default (see app.module.ts).
// Both override the same 'default' throttler bucket registered there — a smaller limit here
// just means this route's own bucket fills up faster than the app-wide one.

// Brute-force protection on login/register/refresh — a real person retrying a typo'd password
// a few times a minute is fine; a script trying hundreds is not.
export const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

// Every AI-calling route is a real, billable Azure AI Foundry request. This caps the cost-abuse
// surface without getting in the way of a person actually using the feature.
export const AI_GENERATION_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

// Composing/sending bulk email carries real reputational risk against the agency's own sending
// identity (spam complaints, provider blocks) — tighter than AI generation, since the cost of
// abuse here isn't just money, it's deliverability for every client sharing that SMTP account.
export const EMAIL_CAMPAIGN_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

// AUTH-3: a SUPER_ADMIN switching into an agency reaches every tenant's data on the platform —
// tighter than even login (AUTH_THROTTLE), and on a longer window, since a real support session
// touching a handful of agencies is normal but rapid-fire switching across many is not.
export const AGENCY_SWITCH_THROTTLE = { default: { limit: 5, ttl: 300_000 } };

// Public, unauthenticated, and sends two real emails per call (one to us, one to the submitter)
// — same reasoning as AUTH_THROTTLE, just for a contact form instead of a login form: a real
// visitor submitting this a few times a day is fine, a script hammering it to spam an inbox or
// run up email-provider costs is not.
export const MARKETING_CONTACT_THROTTLE = { default: { limit: 5, ttl: 60_000 } };
