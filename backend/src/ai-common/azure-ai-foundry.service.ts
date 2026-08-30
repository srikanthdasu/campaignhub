import { BadGatewayException, Injectable } from '@nestjs/common';
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

@Injectable()
export class AzureAiFoundryService {
  constructor(private config: ConfigService) {}

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const endpoint = this.config.getOrThrow<string>('AZURE_AI_FOUNDRY_ENDPOINT');
    const key = this.config.getOrThrow<string>('AZURE_AI_FOUNDRY_KEY');
    const model = this.config.getOrThrow<string>('AZURE_AI_FOUNDRY_TEXT_MODEL');

    let res: Response;
    try {
      res = await fetch(endpoint, {
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
    const endpoint = this.config.getOrThrow<string>('AZURE_AI_FOUNDRY_IMAGE_ENDPOINT');
    const key = this.config.getOrThrow<string>('AZURE_AI_FOUNDRY_IMAGE_KEY');
    const model = this.config.getOrThrow<string>('AZURE_AI_FOUNDRY_IMAGE_MODEL');

    let res: Response;
    try {
      res = await fetch(endpoint, {
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
