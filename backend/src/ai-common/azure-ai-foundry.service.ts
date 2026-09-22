import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class AzureAiFoundryService {
  constructor(private config: ConfigService) {}

  // Retries network failures and 5xx responses (the AI provider's fault, plausibly transient);
  // a 4xx response returns immediately since retrying an invalid request just wastes time.
  // A persistent 5xx after retries are exhausted returns that Response rather than throwing, so
  // callers' existing `!res.ok` handling still produces its specific status-code message — only
  // a run of genuine network-level failures (fetch itself rejecting) throws here.
  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let lastNetworkError: unknown;
    let lastResponse: Response | undefined;
    for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url, init);
        if (res.ok || res.status < 500) return res;
        lastResponse = res;
      } catch (err) {
        lastNetworkError = err;
        lastResponse = undefined;
      }
      if (attempt < MAX_FETCH_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
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
