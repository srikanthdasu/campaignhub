import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

@Controller('audit-logs')
@UseGuards(RolesGuard)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @Roles(Role.OWNER, Role.ADMIN)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const parsedSkip = skip !== undefined ? Number.parseInt(skip, 10) : undefined;
    const parsedTake = take !== undefined ? Number.parseInt(take, 10) : undefined;
    return this.auditService.listForAgencyPaginated(
      user.agencyId!,
      Number.isFinite(parsedSkip) ? parsedSkip : undefined,
      Number.isFinite(parsedTake) ? parsedTake : undefined,
    );
  }
}
