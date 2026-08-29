import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApprovalsService } from './approvals.service.js';
import { DecideStepDto } from './dto/decide-step.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

@Controller('approvals')
export class ApprovalsController {
  constructor(private approvalsService: ApprovalsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.approvalsService.listForUser(user);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.approvalsService.getById(id, user);
  }

  @Post(':id/steps/:stepId/decide')
  decide(
    @Param('id') flowId: string,
    @Param('stepId') stepId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DecideStepDto,
  ) {
    return this.approvalsService.decide(flowId, stepId, user, dto.decision, dto.comment);
  }
}
