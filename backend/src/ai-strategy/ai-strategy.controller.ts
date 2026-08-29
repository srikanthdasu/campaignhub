import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AiStrategyService } from './ai-strategy.service.js';
import { CreateStrategyDto } from './dto/create-strategy.dto.js';
import { ReviewStrategyDto } from './dto/review-strategy.dto.js';
import { FeedbackStrategyDto } from './dto/feedback-strategy.dto.js';
import { ClientAccessGuard } from '../common/guards/client-access.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const CAN_CREATE = [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.CREATOR, Role.DESIGNER];
// Review is the governance gate itself — kept to agency-wide roles, not content creators.
const CAN_REVIEW = [Role.OWNER, Role.ADMIN, Role.MANAGER];

@Controller('clients/:clientId/ai-strategy')
@UseGuards(ClientAccessGuard, RolesGuard)
export class AiStrategyController {
  constructor(private aiStrategyService: AiStrategyService) {}

  @Post()
  @Roles(...CAN_CREATE)
  create(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStrategyDto,
  ) {
    return this.aiStrategyService.create(clientId, user.sub, dto);
  }

  @Get()
  list(@Param('clientId') clientId: string) {
    return this.aiStrategyService.list(clientId);
  }

  @Get(':id')
  getOne(@Param('clientId') clientId: string, @Param('id') id: string) {
    return this.aiStrategyService.getOne(clientId, id);
  }

  @Post(':id/generate')
  @Roles(...CAN_CREATE)
  generate(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aiStrategyService.generate(clientId, id, user.sub);
  }

  @Post(':id/review')
  @Roles(...CAN_REVIEW)
  review(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewStrategyDto,
  ) {
    return this.aiStrategyService.review(clientId, id, user.sub, dto);
  }

  @Post(':id/feedback')
  @Roles(...CAN_CREATE)
  feedback(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: FeedbackStrategyDto,
  ) {
    return this.aiStrategyService.feedback(clientId, id, user.sub, dto);
  }

  @Delete(':id')
  @Roles(...CAN_REVIEW)
  remove(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aiStrategyService.remove(clientId, id, user.sub);
  }
}
