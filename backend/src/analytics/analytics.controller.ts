import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service.js';
import { ClientAccessGuard } from '../common/guards/client-access.guard.js';

@Controller('clients/:clientId/analytics')
@UseGuards(ClientAccessGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('overview')
  getOverview(@Param('clientId') clientId: string) {
    return this.analyticsService.getOverview(clientId);
  }
}
