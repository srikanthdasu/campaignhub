import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AiAssistantService } from './ai-assistant.service.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';
import { AskDto } from './dto/ask.dto.js';
import { ClientAccessGuard } from '../common/guards/client-access.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

@Controller('clients/:clientId/ai-assistant/conversations')
@UseGuards(ClientAccessGuard)
export class AiAssistantController {
  constructor(private aiAssistantService: AiAssistantService) {}

  @Post()
  create(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateConversationDto,
  ) {
    return this.aiAssistantService.createConversation(clientId, user.sub, dto.title);
  }

  @Get()
  list(@Param('clientId') clientId: string) {
    return this.aiAssistantService.listConversations(clientId);
  }

  @Get(':id')
  getOne(@Param('clientId') clientId: string, @Param('id') id: string) {
    return this.aiAssistantService.getConversation(clientId, id);
  }

  @Post(':id/messages')
  ask(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AskDto,
  ) {
    return this.aiAssistantService.ask(clientId, id, user.sub, dto.content);
  }

  @Delete(':id')
  remove(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aiAssistantService.remove(clientId, id, user.sub);
  }
}
