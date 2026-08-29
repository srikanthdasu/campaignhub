import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CampaignsService } from './campaigns.service.js';
import { CreateCampaignDto } from './dto/create-campaign.dto.js';
import { UpdateCampaignDto } from './dto/update-campaign.dto.js';
import { ClientAccessGuard } from '../common/guards/client-access.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const CAN_MANAGE = [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.CREATOR, Role.DESIGNER];
const CAN_DELETE = [Role.OWNER, Role.ADMIN, Role.MANAGER];

@Controller('clients/:clientId/campaigns')
@UseGuards(ClientAccessGuard, RolesGuard)
export class CampaignsController {
  constructor(private campaignsService: CampaignsService) {}

  @Post()
  @Roles(...CAN_MANAGE)
  create(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.campaignsService.create(clientId, user.sub, dto);
  }

  @Get()
  list(@Param('clientId') clientId: string) {
    return this.campaignsService.list(clientId);
  }

  @Get(':id')
  getOne(@Param('clientId') clientId: string, @Param('id') id: string) {
    return this.campaignsService.getOne(clientId, id);
  }

  @Patch(':id')
  @Roles(...CAN_MANAGE)
  update(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(clientId, id, user.sub, dto);
  }

  @Delete(':id')
  @Roles(...CAN_DELETE)
  remove(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaignsService.remove(clientId, id, user.sub);
  }
}
