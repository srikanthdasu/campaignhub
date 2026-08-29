import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { simulateAssistantReply } from '../ai-common/simulated-ai.js';
import { AiMessageRole } from '../generated/prisma/client.js';

@Injectable()
export class AiAssistantService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
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

    const userMessage = await this.prisma.aiMessage.create({
      data: { conversationId: conversation.id, role: AiMessageRole.USER, content },
    });

    const reply = simulateAssistantReply(content);
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
