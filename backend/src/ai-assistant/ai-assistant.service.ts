import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AzureAiFoundryService, type ChatMessage } from '../ai-common/azure-ai-foundry.service.js';
import { AiMessageRole } from '../generated/prisma/client.js';

const SYSTEM_PROMPT =
  'You are the AI Assistant inside CampaignHub AI, a social media management platform. Help the ' +
  'user plan content, write captions, and think through their social strategy. Be concise and ' +
  'actionable. You have no access to this client\'s actual analytics, scheduled posts, or account ' +
  'data beyond what appears in this conversation — do not invent numbers or claim access to data ' +
  'you were not given.';

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
