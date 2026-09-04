import { createHmac, timingSafeEqual } from 'crypto';
import { BadRequestException } from '@nestjs/common';

export interface OAuthState {
  clientId: string;
  actorId: string;
}

// Shared by every social OAuth connector (Facebook, Instagram, and whichever platforms follow) —
// each platform's redirect back carries no session cookie/header of ours, so this HMAC-signed
// state (same approach as RazorpayService's payment signature) is what proves which client/user
// initiated the connection and stops a forged state from attaching a hijacked code to a client
// the requester doesn't actually have access to.
export function encodeOAuthState(state: OAuthState, secret: string): string {
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function decodeOAuthState(encoded: string, secret: string): OAuthState {
  const [payload, signature] = encoded.split('.');
  if (!payload || !signature) throw new BadRequestException('Invalid OAuth state');

  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    throw new BadRequestException('Invalid OAuth state');
  }

  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OAuthState;
}
