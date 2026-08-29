import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SocialAccountsService } from './social-accounts.service.js';
import { CreateSocialAccountDto } from './dto/create-social-account.dto.js';
import { ClientAccessGuard } from '../common/guards/client-access.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const CAN_MANAGE = [Role.OWNER, Role.ADMIN, Role.MANAGER];

@Controller('clients/:clientId/social-accounts')
@UseGuards(ClientAccessGuard, RolesGuard)
export class SocialAccountsController {
  constructor(private socialAccountsService: SocialAccountsService) {}

  @Post()
  @Roles(...CAN_MANAGE)
  create(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSocialAccountDto,
  ) {
    return this.socialAccountsService.create(clientId, user.sub, dto);
  }

  @Get()
  list(@Param('clientId') clientId: string) {
    return this.socialAccountsService.list(clientId);
  }

  @Delete(':id')
  @Roles(...CAN_MANAGE)
  remove(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.socialAccountsService.remove(clientId, id, user.sub);
  }
}
