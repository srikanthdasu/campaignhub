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

  it('rejects a production config missing SMTP settings', () => {
    expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow(/SMTP_HOST/);
  });

  it('passes a production config with all SMTP, storage, encryption-key, and Razorpay settings present', () => {
    const config = {
      NODE_ENV: 'production',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '587',
      SMTP_USER: 'user@gmail.com',
      SMTP_PASSWORD: 'app-password',
      AZURE_STORAGE_CONNECTION_STRING: 'DefaultEndpointsProtocol=https;...',
      TOKEN_ENCRYPTION_KEY: 'd'.repeat(32),
      RAZORPAY_KEY_ID: 'rzp_live_placeholder',
      RAZORPAY_KEY_SECRET: 'e'.repeat(32),
      RAZORPAY_WEBHOOK_SECRET: 'f'.repeat(32),
    };
    expect(validateEnv(config)).toEqual(config);
  });

  it('does not require SMTP, storage, or Razorpay settings outside production', () => {
    expect(() => validateEnv({ NODE_ENV: 'development' })).not.toThrow();
  });

  const completeProductionConfig = () => ({
    NODE_ENV: 'production',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '587',
    SMTP_USER: 'user@gmail.com',
    SMTP_PASSWORD: 'app-password',
    AZURE_STORAGE_CONNECTION_STRING: 'DefaultEndpointsProtocol=https;...',
    TOKEN_ENCRYPTION_KEY: 'd'.repeat(32),
    RAZORPAY_KEY_ID: 'rzp_live_placeholder',
    RAZORPAY_KEY_SECRET: 'e'.repeat(32),
    RAZORPAY_WEBHOOK_SECRET: 'f'.repeat(32),
  });

  it('rejects a production config missing AZURE_STORAGE_CONNECTION_STRING even with everything else present', () => {
    const config = completeProductionConfig() as Record<string, string | undefined>;
    delete config.AZURE_STORAGE_CONNECTION_STRING;
    expect(() => validateEnv(config)).toThrow(/AZURE_STORAGE_CONNECTION_STRING/);
  });

  it('rejects a production config missing TOKEN_ENCRYPTION_KEY (SEC-2)', () => {
    const config = completeProductionConfig() as Record<string, string | undefined>;
    delete config.TOKEN_ENCRYPTION_KEY;
    expect(() => validateEnv(config)).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });

  it('rejects a production config missing RAZORPAY_KEY_ID (P1-3) even with everything else present', () => {
    const config = completeProductionConfig() as Record<string, string | undefined>;
    delete config.RAZORPAY_KEY_ID;
    expect(() => validateEnv(config)).toThrow(/RAZORPAY_KEY_ID/);
  });

  it('rejects a production config missing RAZORPAY_KEY_SECRET (P1-3) even with everything else present', () => {
    const config = completeProductionConfig() as Record<string, string | undefined>;
    delete config.RAZORPAY_KEY_SECRET;
    expect(() => validateEnv(config)).toThrow(/RAZORPAY_KEY_SECRET/);
  });

  it('rejects a production config missing RAZORPAY_WEBHOOK_SECRET (P1-3) even with everything else present', () => {
    const config = completeProductionConfig() as Record<string, string | undefined>;
    delete config.RAZORPAY_WEBHOOK_SECRET;
    expect(() => validateEnv(config)).toThrow(/RAZORPAY_WEBHOOK_SECRET/);
  });

  it('reports every missing Razorpay variable by name, together, when more than one is absent (P1-3)', () => {
    const config = completeProductionConfig() as Record<string, string | undefined>;
    delete config.RAZORPAY_KEY_ID;
    delete config.RAZORPAY_KEY_SECRET;
    delete config.RAZORPAY_WEBHOOK_SECRET;
    expect(() => validateEnv(config)).toThrow(
      /RAZORPAY_KEY_ID.*RAZORPAY_KEY_SECRET.*RAZORPAY_WEBHOOK_SECRET/,
    );
  });

  it('rejects a long but un-replaced "change-me" placeholder, not just a short one (SEC-2)', () => {
    expect(() =>
      validateEnv({ TOKEN_ENCRYPTION_KEY: 'change-me-to-something-at-least-20-characters-long' }),
    ).toThrow(/placeholder/);
  });
});
