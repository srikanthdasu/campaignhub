import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdsService } from './ads.service.js';
import { CreateAdDto } from './dto/create-ad.dto.js';
import { UpdateAdDto } from './dto/update-ad.dto.js';
import { ReviewAdDto } from './dto/review-ad.dto.js';
import { ClientAccessGuard } from '../common/guards/client-access.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const CAN_MANAGE = [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.CREATOR, Role.DESIGNER];
// Review and Launch are the budget/permission gate the book calls out explicitly — kept to
// agency-wide roles, same split as AI Strategy & Governance's review step.
const CAN_APPROVE_AND_LAUNCH = [Role.OWNER, Role.ADMIN, Role.MANAGER];

@Controller('clients/:clientId/ads')
@UseGuards(ClientAccessGuard, RolesGuard)
export class AdsController {
  constructor(private adsService: AdsService) {}

  @Post()
  @Roles(...CAN_MANAGE)
  create(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAdDto,
  ) {
    return this.adsService.create(clientId, user.sub, dto);
  }

  @Get()
  list(@Param('clientId') clientId: string) {
    return this.adsService.list(clientId);
  }

  @Get(':id')
  getOne(@Param('clientId') clientId: string, @Param('id') id: string) {
    return this.adsService.getOne(clientId, id);
  }

  @Patch(':id')
  @Roles(...CAN_MANAGE)
  update(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAdDto,
  ) {
    return this.adsService.update(clientId, id, user.sub, dto);
  }

  @Post(':id/submit')
  @Roles(...CAN_MANAGE)
  submit(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adsService.submitForApproval(clientId, id, user.sub);
  }

  @Post(':id/review')
  @Roles(...CAN_APPROVE_AND_LAUNCH)
  review(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewAdDto,
  ) {
    return this.adsService.review(clientId, id, user, dto);
  }

  @Post(':id/launch')
  @Roles(...CAN_APPROVE_AND_LAUNCH)
  launch(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adsService.launch(clientId, id, user.sub);
  }

  @Delete(':id')
  @Roles(...CAN_MANAGE)
  remove(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adsService.remove(clientId, id, user.sub);
  }
}
