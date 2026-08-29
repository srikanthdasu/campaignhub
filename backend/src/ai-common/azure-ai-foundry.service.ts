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
}
