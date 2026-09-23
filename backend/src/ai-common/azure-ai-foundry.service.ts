import { BadGatewayException, HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
}

interface FoundryChatCompletion {
  choices?: { message?: { content?: string } }[];
}

interface FoundryImageGeneration {
  data?: { b64_json?: string }[];
}

// A brief hiccup from the AI provider (a dropped connection, a transient 5xx) shouldn't become
// an immediate user-facing error — a couple of quick retries covers that without masking a
// genuinely broken request (4xx, or a request that fails 3 times in a row) behind false progress.
const MAX_FETCH_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 300;

// AI-3: a 429 is a different failure mode from a genuine bad request — it's the provider saying
// "you're going too fast," and this is the single most likely real-world AI failure mode under
// load. It's worth retrying (unlike other 4xx status codes, which mean the request itself is
// invalid and retrying wastes time) — but only up to this cap on how long a Retry-After header is
// honored, so a provider asking for a multi-minute backoff doesn't hang the request instead of
// just failing fast with a clear message.
const MAX_RETRY_AFTER_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimited(res: Response): boolean {
  return res.status === 429;
}

// Retry-After can be sent as either a delay in seconds or an HTTP-date — this only trusts the
// simple, common seconds form; anything else (including no header at all) falls back to the same
// exponential backoff every other retryable failure already uses.
function retryAfterMs(res: Response): number | null {
  const header = res.headers.get('retry-after');
  if (!header) return null;
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
}

// Distinct from both BadGatewayException (a generic provider failure) and this app's own
// @nestjs/throttler 429 (us rate-limiting the caller) — this is specifically the AI provider
// telling *us* to slow down, after retries already failed to get past it.
function rateLimitException(serviceName: string): HttpException {
  return new HttpException(
    `The AI provider is rate-limiting ${serviceName} requests right now. Please wait a moment and try again.`,
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

@Injectable()
export class AzureAiFoundryService {
  constructor(private config: ConfigService) {}

  // Retries network failures, 5xx responses, and 429s (all plausibly transient); any other 4xx
  // returns immediately since retrying a genuinely invalid request just wastes time. A persistent
  // failure after retries are exhausted returns that Response rather than throwing, so callers'
  // existing `!res.ok`/isRateLimited handling still produces its specific message — only a run of
  // genuine network-level failures (fetch itself rejecting) throws here.
  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let lastNetworkError: unknown;
    let lastResponse: Response | undefined;
    for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
      let delayMs = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      try {
        const res = await fetch(url, init);
        if (res.ok || (res.status < 500 && !isRateLimited(res))) return res;
        lastResponse = res;
        if (isRateLimited(res)) delayMs = retryAfterMs(res) ?? delayMs;
      } catch (err) {
        lastNetworkError = err;
        lastResponse = undefined;
      }
      if (attempt < MAX_FETCH_ATTEMPTS) {
        await sleep(delayMs);
      }
    }
    if (lastResponse) return lastResponse;
    throw lastNetworkError;
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    // Unlike VideoGenerationService's kill switch (default OFF, no budget yet), text/image
    // generation are live, actively-used product features — this is an emergency spend lever,
    // not a launch gate, so it defaults ON and only blocks when explicitly disabled.
    if (this.config.get<string>('AI_TEXT_GENERATION_ENABLED') === 'false') {
      throw new ServiceUnavailableException('AI text generation is temporarily disabled.');
    }

    const endpoint = this.config.getOrThrow<string>('AZURE_AI_FOUNDRY_ENDPOINT');
    const key = this.config.getOrThrow<string>('AZURE_AI_FOUNDRY_KEY');
    const model = this.config.getOrThrow<string>('AZURE_AI_FOUNDRY_TEXT_MODEL');

    let res: Response;
    try {
      res = await this.fetchWithRetry(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': key },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: options.maxTokens ?? 600,
          temperature: options.temperature ?? 0.7,
        }),
      });
    } catch {
      throw new BadGatewayException('Could not reach the AI service. Please try again.');
    }

    if (isRateLimited(res)) throw rateLimitException('chat');
    if (!res.ok) {
      throw new BadGatewayException(`AI service request failed (${res.status}). Please try again.`);
    }

    const body = (await res.json()) as FoundryChatCompletion;
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new BadGatewayException('The AI service returned an empty response. Please try again.');
    }
    return content;
  }

  /** Returns raw PNG bytes for the given prompt. */
  async generateImage(prompt: string, size = '1024x1024'): Promise<Buffer> {
    // Same emergency-lever pattern as chat() above — defaults ON.
    if (this.config.get<string>('AI_IMAGE_GENERATION_ENABLED') === 'false') {
      throw new ServiceUnavailableException('AI image generation is temporarily disabled.');
    }

    const endpoint = this.config.getOrThrow<string>('AZURE_AI_FOUNDRY_IMAGE_ENDPOINT');
    const key = this.config.getOrThrow<string>('AZURE_AI_FOUNDRY_IMAGE_KEY');
    const model = this.config.getOrThrow<string>('AZURE_AI_FOUNDRY_IMAGE_MODEL');

    let res: Response;
    try {
      res = await this.fetchWithRetry(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': key },
        body: JSON.stringify({ model, prompt, n: 1, size }),
      });
    } catch {
      throw new BadGatewayException('Could not reach the AI image service. Please try again.');
    }

    if (isRateLimited(res)) throw rateLimitException('image generation');
    if (!res.ok) {
      throw new BadGatewayException(`AI image service request failed (${res.status}). Please try again.`);
    }

    const body = (await res.json()) as FoundryImageGeneration;
    const b64 = body.data?.[0]?.b64_json;
    if (typeof b64 !== 'string' || !b64) {
      throw new BadGatewayException('The AI image service returned no image. Please try again.');
    }
    return Buffer.from(b64, 'base64');
  }
}
