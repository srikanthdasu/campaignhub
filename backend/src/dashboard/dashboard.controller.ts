import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

@Controller('dashboard')
@UseGuards(RolesGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('overview')
  getOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getOverview(user.agencyId!);
  }
}
