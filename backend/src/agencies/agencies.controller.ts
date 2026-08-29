import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AgenciesService } from './agencies.service.js';
import { UpdateAgencyDto } from './dto/update-agency.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

@Controller('agencies/me')
@UseGuards(RolesGuard)
export class AgenciesController {
  constructor(private agenciesService: AgenciesService) {}

  @Get()
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.agenciesService.getMine(user.agencyId!);
  }

  @Patch('settings')
  @Roles(Role.OWNER, Role.ADMIN)
  updateSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateAgencyDto) {
    return this.agenciesService.updateSettings(user.agencyId!, user.sub, dto);
  }
}
