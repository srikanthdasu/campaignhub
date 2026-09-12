import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

// This is an agency-wide rollup across every client — CLIENT-role portal users must never see it
// (it would leak other clients' post content and the agency's own activity feed to them).
const NON_CLIENT_ROLES = [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.CREATOR, Role.DESIGNER, Role.ANALYST];

@Controller('dashboard')
@UseGuards(RolesGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('overview')
  @Roles(...NON_CLIENT_ROLES)
  getOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getOverview(user.agencyId!);
  }
}
