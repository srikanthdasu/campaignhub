// Shared @Throttle() overrides layered on top of the global default (see app.module.ts).
// Both override the same 'default' throttler bucket registered there — a smaller limit here
// just means this route's own bucket fills up faster than the app-wide one.

// Brute-force protection on login/register/refresh — a real person retrying a typo'd password
// a few times a minute is fine; a script trying hundreds is not.
export const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

// Every AI-calling route is a real, billable Azure AI Foundry request. This caps the cost-abuse
// surface without getting in the way of a person actually using the feature.
export const AI_GENERATION_THROTTLE = { default: { limit: 20, ttl: 60_000 } };
