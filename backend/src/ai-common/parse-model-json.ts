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

// Beyond a full code fence, models sometimes preface/follow the JSON with plain-text commentary
// ("Sure, here's the script: {...}\nLet me know if you'd like changes!") — find the outermost
// {...} or [...] span and retry on that before giving up, rather than failing the whole request.
function extractJsonSpan(text: string): string | null {
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  let start: number;
  let closeChar: string;
  if (firstBrace === -1 && firstBracket === -1) return null;
  if (firstBracket === -1 || (firstBrace !== -1 && firstBrace < firstBracket)) {
    start = firstBrace;
    closeChar = '}';
  } else {
    start = firstBracket;
    closeChar = ']';
  }
  const end = text.lastIndexOf(closeChar);
  if (end === -1 || end < start) return null;
  return text.slice(start, end + 1);
}

// Models sometimes write a multi-line "script" as literal newlines inside a JSON string value
// instead of escaping them as \n — valid-looking text that is actually invalid JSON, since the
// spec forbids raw control characters inside a string. Walk the text tracking whether we're
// inside a string (respecting backslash escapes) and escape any literal newline/tab/carriage
// return found there. Text outside strings (structural whitespace) is left untouched.
function escapeControlCharsInStrings(text: string): string {
  let result = '';
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (!inString) {
      if (ch === '"') inString = true;
      result += ch;
      continue;
    }
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      result += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = false;
      result += ch;
      continue;
    }
    if (ch === '\n') {
      result += '\\n';
    } else if (ch === '\r') {
      result += '\\r';
    } else if (ch === '\t') {
      result += '\\t';
    } else {
      result += ch;
    }
  }
  return result;
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function parseModelJson<T>(raw: string, isValid: (value: unknown) => value is T): T {
  const cleaned = escapeControlCharsInStrings(stripCodeFence(raw));

  let parsed = tryParse(cleaned);
  if (parsed === undefined) {
    const span = extractJsonSpan(cleaned);
    parsed = span === null ? undefined : tryParse(span);
  }
  if (parsed === undefined) {
    throw new BadGatewayException('The AI service returned a response we could not parse. Please try again.');
  }

  if (!isValid(parsed)) {
    throw new BadGatewayException('The AI service returned an unexpected response. Please try again.');
  }

  return parsed;
}
