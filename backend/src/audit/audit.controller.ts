import { Controller, Get, UseGuards } from '@nestjs/common';
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
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.auditService.listForAgency(user.agencyId!);
  }
}
