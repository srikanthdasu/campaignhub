import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AiCaptionsService } from './ai-captions.service.js';
import { GenerateCaptionsDto } from './dto/generate-captions.dto.js';
import { SaveCaptionDto } from './dto/save-caption.dto.js';
import { ClientAccessGuard } from '../common/guards/client-access.guard.js';
import { ClientContentCreationGuard } from '../common/guards/client-content-creation.guard.js';
import { AiSpendCapGuard } from '../common/guards/ai-spend-cap.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { AI_GENERATION_THROTTLE } from '../common/rate-limits.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const CAN_CREATE = [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.CREATOR, Role.DESIGNER, Role.CLIENT];

@Controller('clients/:clientId/ai-captions')
@UseGuards(ClientAccessGuard, RolesGuard, ClientContentCreationGuard)
export class AiCaptionsController {
  constructor(private aiCaptionsService: AiCaptionsService) {}

  @Throttle(AI_GENERATION_THROTTLE)
  @UseGuards(AiSpendCapGuard)
  @Post('generate')
  @Roles(...CAN_CREATE)
  generate(@CurrentUser() user: AuthenticatedUser, @Body() dto: GenerateCaptionsDto) {
    return this.aiCaptionsService.generate(user.sub, dto);
  }

  @Post()
  @Roles(...CAN_CREATE)
  save(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveCaptionDto,
  ) {
    return this.aiCaptionsService.save(clientId, user.sub, dto);
  }

  @Get()
  list(@Param('clientId') clientId: string) {
    return this.aiCaptionsService.list(clientId);
  }

  @Delete(':id')
  @Roles(...CAN_CREATE)
  remove(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aiCaptionsService.remove(clientId, id, user.sub);
  }
}
