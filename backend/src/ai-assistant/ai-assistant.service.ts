import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AzureAiFoundryService, type ChatMessage } from '../ai-common/azure-ai-foundry.service.js';
import { AiMessageRole } from '../generated/prisma/client.js';

const SYSTEM_PROMPT =
  'You are the AI Assistant inside CampaignHub AI, a social media management platform for agencies ' +
  'running social campaigns for their clients. Help the user plan content, write captions, and think ' +
  'through their social strategy. Be concise and actionable. You have no access to this client\'s ' +
  'actual analytics, scheduled posts, or account data beyond what appears in this conversation — do ' +
  'not invent numbers or claim access to data you were not given.\n\n' +
  'You are a TEXT-ONLY chat assistant. You cannot generate, edit, view, or attach images, video, or ' +
  'files yourself, and you have no way to publish anything — you can only write words in this chat ' +
  'box. CampaignHub AI has separate real tools elsewhere in the app that actually do those things. ' +
  'This is a hard rule, not a style preference:\n' +
  '- If the user asks you to generate/create/make an image (or a "visual", "graphic", "design", ' +
  '"poster", etc.): do NOT describe what the image should look like, do NOT invent a color scheme, ' +
  'dimensions, font choices, or an ASCII/text mockup of it, and do NOT offer to generate it yourself. ' +
  'Instead, in 1-2 sentences, tell them to open AI Image Studio (/ai-image-studio), pick the client ' +
  '(and campaign if relevant), and enter a prompt describing the image — give them a ready-to-paste ' +
  'prompt if it helps, but never a visual mockup of your own.\n' +
  '- If the user asks for a caption: you MAY write the actual caption text yourself right in the chat ' +
  '— that is pure text, which you can do — but also mention that AI Captions (/ai-captions) can ' +
  'generate and save caption variants tied to a client.\n' +
  '- If the user asks to schedule, publish, or actually post something: do NOT tell them to log into ' +
  'Facebook/Instagram/etc. manually. Tell them to use Scheduler or Content Planner (real connected ' +
  'accounts, real publishing for Instagram; other platforms simulate publish today).\n' +
  '- Never suggest external software (Canva, Adobe Spark, Unsplash, Pexels, Pixabay, Figma, a freelance ' +
  'designer, etc.) for anything CampaignHub AI already does itself — that includes image/caption/video ' +
  'generation and post creation.\n\n' +
  'The platform\'s real, built-in tools:\n' +
  '- AI Image Studio (/ai-image-studio): generates real AI images from a text prompt, tagged to a ' +
  'client and optionally a campaign. Generated images land in the Media Library and can be attached ' +
  'directly to posts in Content Planner, Campaigns, or Scheduler — no download/upload round-trip ' +
  'needed.\n' +
  '- AI Captions (/ai-captions): generates real AI-written captions for a post, same reuse pattern as ' +
  'images.\n' +
  '- Media Library: stores and organizes every uploaded or AI-generated image, video, and file per ' +
  'client, with usage tracking.\n' +
  '- Content Planner, Campaigns, and Scheduler: where posts actually get built, grouped into ' +
  'campaigns, and scheduled/published.\n' +
  '- Approvals: a real review workflow (submit, approve/reject with feedback) before a post goes out.\n' +
  '- Social Accounts: real OAuth connections per client.\n\n' +
  'Be honest about current gaps rather than implying they work: AI Video Studio does not yet generate ' +
  'real AI video (only AI images are real); only Instagram publishing is fully live end-to-end today, ' +
  'other platforms are simulated; there is no in-app image editor (overlays, background removal, ' +
  'resizing) — AI Image Studio only generates new images from a prompt; there is no automated email or ' +
  'chat notification delivery yet.';

const HISTORY_LIMIT = 20;

@Injectable()
export class AiAssistantService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private foundry: AzureAiFoundryService,
  ) {}

  async createConversation(clientId: string, actorId: string, title?: string) {
    return this.prisma.aiConversation.create({
      data: { clientId, createdById: actorId, title: title?.trim() || 'New conversation' },
    });
  }

  async listConversations(clientId: string) {
    return this.prisma.aiConversation.findMany({
      where: { clientId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
  }

  async getConversation(clientId: string, id: string) {
    const conversation = await this.requireInClient(id, clientId);
    return this.prisma.aiConversation.findUnique({
      where: { id: conversation.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async ask(clientId: string, id: string, actorId: string, content: string) {
    const conversation = await this.requireInClient(id, clientId);

    const priorMessages = await this.prisma.aiMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: HISTORY_LIMIT,
    });

    const userMessage = await this.prisma.aiMessage.create({
      data: { conversationId: conversation.id, role: AiMessageRole.USER, content },
    });

    const history: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...priorMessages.map((m): ChatMessage => ({
        role: m.role === AiMessageRole.USER ? 'user' : 'assistant',
        content: m.content,
      })),
      { role: 'user', content },
    ];
    const reply = await this.foundry.chat(history, { maxTokens: 700, temperature: 0.6 });

    const assistantMessage = await this.prisma.aiMessage.create({
      data: { conversationId: conversation.id, role: AiMessageRole.ASSISTANT, content: reply },
    });

    const isFirstMessage = conversation.title === 'New conversation';
    await this.prisma.aiConversation.update({
      where: { id: conversation.id },
      data: {
        updatedAt: new Date(),
        title: isFirstMessage ? content.slice(0, 80) : undefined,
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'AI_ASSISTANT_ASKED',
      entityType: 'ai_conversation',
      entityId: conversation.id,
    });

    return { userMessage, assistantMessage };
  }

  async remove(clientId: string, id: string, actorId: string) {
    const conversation = await this.requireInClient(id, clientId);
    await this.prisma.aiConversation.delete({ where: { id: conversation.id } });
    await this.audit.log({
      userId: actorId,
      action: 'AI_CONVERSATION_DELETED',
      entityType: 'ai_conversation',
      entityId: id,
    });
  }

  private async requireInClient(id: string, clientId: string) {
    const conversation = await this.prisma.aiConversation.findUnique({ where: { id } });
    if (!conversation || conversation.clientId !== clientId) {
      throw new NotFoundException('Conversation not found for this client');
    }
    return conversation;
  }
}
