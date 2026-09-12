import { describe, expect, it } from 'vitest';
import { validateEnv } from './validate-env.js';

describe('validateEnv', () => {
  it('passes through a config where secrets are long enough', () => {
    const config = {
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      TOKEN_ENCRYPTION_KEY: 'c'.repeat(32),
      OTHER_VAR: 'anything',
    };
    expect(validateEnv(config)).toEqual(config);
  });

  it('rejects a JWT_ACCESS_SECRET that is too short', () => {
    expect(() => validateEnv({ JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects an un-replaced placeholder-style secret', () => {
    expect(() => validateEnv({ TOKEN_ENCRYPTION_KEY: 'change-me' })).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });

  it('does not throw when a secret is simply absent (left to getOrThrow elsewhere)', () => {
    expect(() => validateEnv({ SOME_UNRELATED_VAR: 'x' })).not.toThrow();
  });

  it('does not throw on an empty-string secret (treated as absent, not "weak")', () => {
    expect(() => validateEnv({ JWT_REFRESH_SECRET: '' })).not.toThrow();
  });
});
