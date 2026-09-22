const MIN_SECRET_LENGTH = 20;

// These gate session integrity (JWT) and stored-OAuth-token confidentiality (encryption key) —
// a short or placeholder value here is a silent, total compromise with no other safety net.
// Absence is still handled by each service's own `ConfigService.getOrThrow`; this only rejects
// a *present* value that's too weak to trust (e.g. an un-replaced ".env.example" default).
const SECRETS_TO_VALIDATE = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'TOKEN_ENCRYPTION_KEY'] as const;

// SEC-2: the length check alone doesn't catch every un-replaced placeholder — .env.example's own
// TOKEN_ENCRYPTION_KEY default ("change-me-to-something-at-least-20-characters-long") is 52
// characters, long enough to pass MIN_SECRET_LENGTH if someone genuinely deployed with it
// untouched. Every placeholder in .env.example starts with "change-me" — reject that prefix
// outright regardless of length, rather than trying to build a general entropy heuristic.
const PLACEHOLDER_PREFIX = 'change-me';

// EmailService degrades to logging-not-sending if any of these are unset — the right call when
// email was a best-effort notification channel, but registration now requires clicking a
// verification link to activate an account at all. A production deploy missing one of these would
// accept every registration and let nobody ever log in, silently.
const REQUIRED_SMTP_VARS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'] as const;

// BlobStorageService silently falls back to Azure App Service's local disk when this is unset —
// fine for local dev, a real Critical-tier data-loss risk in production, since that disk is
// wiped on every restart/scale event/deploy. Failing to start is far better than every client
// upload quietly vanishing on the next deploy with the database still pointing at dead links.
// TOKEN_ENCRYPTION_KEY joins this list for SEC-2: unlike SMTP/storage, its absence used to be
// deferred to each service's own getOrThrow at first use — meaning a production deploy with no
// key boots green and only fails the first time someone connects a social account, or worse,
// when the scheduler tries to decrypt a token to actually publish.
const REQUIRED_PRODUCTION_VARS = ['AZURE_STORAGE_CONNECTION_STRING', 'TOKEN_ENCRYPTION_KEY'] as const;

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  for (const key of SECRETS_TO_VALIDATE) {
    const value = config[key];
    if (typeof value === 'string' && value.length > 0 && value.length < MIN_SECRET_LENGTH) {
      throw new Error(
        `${key} is only ${value.length} characters long — it must be at least ${MIN_SECRET_LENGTH} ` +
          `to be a safe signing/encryption secret. Generate one with e.g. \`openssl rand -base64 32\`.`,
      );
    }
    if (typeof value === 'string' && value.toLowerCase().startsWith(PLACEHOLDER_PREFIX)) {
      throw new Error(
        `${key} still has its ".env.example" placeholder value — replace it with a real secret ` +
          `(e.g. \`openssl rand -base64 32\`) before starting the app.`,
      );
    }
  }

  if (config.NODE_ENV === 'production') {
    const missingSmtp = REQUIRED_SMTP_VARS.filter((key) => !config[key]);
    if (missingSmtp.length > 0) {
      throw new Error(
        `Missing required SMTP settings for production: ${missingSmtp.join(', ')}. Email verification is ` +
          `required to activate a new account — without these, registration silently stops working.`,
      );
    }

    const missingProduction = REQUIRED_PRODUCTION_VARS.filter((key) => !config[key]);
    if (missingProduction.length > 0) {
      throw new Error(
        `Missing required production settings: ${missingProduction.join(', ')}. Without ` +
          `AZURE_STORAGE_CONNECTION_STRING, uploaded media silently falls back to local disk and is lost ` +
          `on the next restart/deploy; without TOKEN_ENCRYPTION_KEY, connecting a social account or ` +
          `publishing a scheduled post fails the first time it's attempted, not at boot.`,
      );
    }
  }

  return config;
}
