import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AiAssistantService } from './ai-assistant.service.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';
import { AskDto } from './dto/ask.dto.js';
import { ClientAccessGuard } from '../common/guards/client-access.guard.js';
import { ClientContentCreationGuard } from '../common/guards/client-content-creation.guard.js';
import { AiSpendCapGuard } from '../common/guards/ai-spend-cap.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { AI_GENERATION_THROTTLE } from '../common/rate-limits.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

// AUTH-4: DELETE had no role gate at all — any granted role, including CLIENT/ANALYST, could
// delete any conversation for the client, not just their own (remove() has no per-creator
// ownership check). Matches media.controller.ts's CAN_MANAGE precedent.
const CAN_MANAGE = [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.CREATOR, Role.DESIGNER];

@Controller('clients/:clientId/ai-assistant/conversations')
@UseGuards(ClientAccessGuard, RolesGuard)
export class AiAssistantController {
  constructor(private aiAssistantService: AiAssistantService) {}

  @Post()
  @UseGuards(ClientContentCreationGuard)
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

  @Throttle(AI_GENERATION_THROTTLE)
  @UseGuards(ClientContentCreationGuard, AiSpendCapGuard)
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
  @Roles(...CAN_MANAGE)
  remove(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aiAssistantService.remove(clientId, id, user.sub);
  }
}
