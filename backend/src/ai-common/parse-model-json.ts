import { BadGatewayException } from '@nestjs/common';

// Models are prompted to return only JSON, but frequently wrap it in a markdown code fence
// anyway — strip that before parsing rather than fighting the model on every call.
export function stripCodeFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

export function parseModelJson<T>(raw: string, isValid: (value: unknown) => value is T): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    throw new BadGatewayException('The AI service returned a response we could not parse. Please try again.');
  }

  if (!isValid(parsed)) {
    throw new BadGatewayException('The AI service returned an unexpected response. Please try again.');
  }

  return parsed;
}
