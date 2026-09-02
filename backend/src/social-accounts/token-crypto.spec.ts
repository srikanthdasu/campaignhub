import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken } from './token-crypto.js';

const SECRET = 'test-only-secret';

describe('token-crypto', () => {
  it('decrypts back to the original plaintext', () => {
    const ciphertext = encryptToken('EAABwzLix...realFacebookToken', SECRET);
    expect(decryptToken(ciphertext, SECRET)).toBe('EAABwzLix...realFacebookToken');
  });

  it('produces different ciphertext for the same plaintext each time (random IV)', () => {
    const a = encryptToken('same-token', SECRET);
    const b = encryptToken('same-token', SECRET);
    expect(a).not.toBe(b);
  });

  it('fails to decrypt with the wrong secret rather than silently returning garbage', () => {
    const ciphertext = encryptToken('a-real-token', SECRET);
    expect(() => decryptToken(ciphertext, 'wrong-secret')).toThrow();
  });

  it('fails to decrypt tampered ciphertext', () => {
    const ciphertext = encryptToken('a-real-token', SECRET);
    const [iv, tag, data] = ciphertext.split('.');
    const tampered = [iv, tag, data.slice(0, -2) + 'AA'].join('.');
    expect(() => decryptToken(tampered, SECRET)).toThrow();
  });
});
