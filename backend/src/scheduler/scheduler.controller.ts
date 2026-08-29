import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SchedulerService } from './scheduler.service.js';
import { CreateScheduleDto } from './dto/create-schedule.dto.js';
import { RescheduleDto } from './dto/reschedule.dto.js';
import { ClientAccessGuard } from '../common/guards/client-access.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const CAN_SCHEDULE = [Role.OWNER, Role.ADMIN, Role.MANAGER];

@Controller()
export class SchedulerController {
  constructor(private schedulerService: SchedulerService) {}

  @Post('clients/:clientId/content/:id/schedule')
  @UseGuards(ClientAccessGuard, RolesGuard)
  @Roles(...CAN_SCHEDULE)
  schedule(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.schedulerService.schedule(clientId, id, user, dto);
  }

  @Get('clients/:clientId/scheduled-posts')
  @UseGuards(ClientAccessGuard)
  list(
    @Param('clientId') clientId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.schedulerService.listForClient(clientId, from, to);
  }

  @Patch('scheduled-posts/:id')
  @UseGuards(RolesGuard)
  @Roles(...CAN_SCHEDULE)
  reschedule(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RescheduleDto,
  ) {
    return this.schedulerService.reschedule(id, user, dto.scheduledTime);
  }

  @Delete('scheduled-posts/:id')
  @UseGuards(RolesGuard)
  @Roles(...CAN_SCHEDULE)
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.schedulerService.cancel(id, user);
  }

  @Post('scheduled-posts/:id/publish')
  @UseGuards(RolesGuard)
  @Roles(...CAN_SCHEDULE)
  publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.schedulerService.markPublished(id, user);
  }
}
