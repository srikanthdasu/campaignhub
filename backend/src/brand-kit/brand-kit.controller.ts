import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { BrandKitService } from './brand-kit.service.js';
import { UpsertBrandKitDto } from './dto/upsert-brand-kit.dto.js';
import { ClientAccessGuard } from '../common/guards/client-access.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

@Controller('clients/:clientId/brand-kit')
@UseGuards(ClientAccessGuard, RolesGuard)
export class BrandKitController {
  constructor(private brandKitService: BrandKitService) {}

  @Get()
  get(@Param('clientId') clientId: string) {
    return this.brandKitService.get(clientId);
  }

  @Put()
  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER)
  upsert(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertBrandKitDto,
  ) {
    return this.brandKitService.upsert(clientId, user.sub, dto);
  }
}
