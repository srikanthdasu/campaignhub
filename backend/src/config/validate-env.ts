const MIN_SECRET_LENGTH = 20;

// These gate session integrity (JWT) and stored-OAuth-token confidentiality (encryption key) —
// a short or placeholder value here is a silent, total compromise with no other safety net.
// Absence is still handled by each service's own `ConfigService.getOrThrow`; this only rejects
// a *present* value that's too weak to trust (e.g. an un-replaced ".env.example" default).
const SECRETS_TO_VALIDATE = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'TOKEN_ENCRYPTION_KEY'] as const;

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
  return config;
}
