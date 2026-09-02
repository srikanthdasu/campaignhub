import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// A real OAuth access token is bearer credential for someone's Facebook/Instagram account —
// storing it in plaintext in the database would mean a DB leak also leaks every connected
// social account, not just this app's own data. AES-256-GCM with a random IV per encryption and
// the auth tag stored alongside it is the standard authenticated-encryption approach: it detects
// tampering (a flipped bit fails to decrypt) as well as hiding the plaintext.
function deriveKey(secret: string): Buffer {
  // scrypt rather than using the secret directly — TOKEN_ENCRYPTION_KEY may not be exactly 32
  // bytes as typed into an env var; this deterministically stretches/compresses it to fit AES-256.
  return scryptSync(secret, 'campaignhub-token-crypto', 32);
}

export function encryptToken(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((buf) => buf.toString('base64')).join('.');
}

export function decryptToken(ciphertext: string, secret: string): string {
  const [ivB64, authTagB64, encryptedB64] = ciphertext.split('.');
  const key = deriveKey(secret);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
