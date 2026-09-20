const MIN_SECRET_LENGTH = 20;

// These gate session integrity (JWT) and stored-OAuth-token confidentiality (encryption key) —
// a short or placeholder value here is a silent, total compromise with no other safety net.
// Absence is still handled by each service's own `ConfigService.getOrThrow`; this only rejects
// a *present* value that's too weak to trust (e.g. an un-replaced ".env.example" default).
const SECRETS_TO_VALIDATE = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'TOKEN_ENCRYPTION_KEY'] as const;

// EmailService degrades to logging-not-sending if any of these are unset — the right call when
// email was a best-effort notification channel, but registration now requires clicking a
// verification link to activate an account at all. A production deploy missing one of these would
// accept every registration and let nobody ever log in, silently.
const REQUIRED_SMTP_VARS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'] as const;

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  for (const key of SECRETS_TO_VALIDATE) {
    const value = config[key];
    if (typeof value === 'string' && value.length > 0 && value.length < MIN_SECRET_LENGTH) {
      throw new Error(
        `${key} is only ${value.length} characters long — it must be at least ${MIN_SECRET_LENGTH} ` +
          `to be a safe signing/encryption secret. Generate one with e.g. \`openssl rand -base64 32\`.`,
      );
    }
  }

  if (config.NODE_ENV === 'production') {
    const missing = REQUIRED_SMTP_VARS.filter((key) => !config[key]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required SMTP settings for production: ${missing.join(', ')}. Email verification is ` +
          `required to activate a new account — without these, registration silently stops working.`,
      );
    }
  }

  return config;
}
