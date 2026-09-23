import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { DemoLeadsService } from './demo-leads.service.js';
import { CreateDemoLeadDto } from './dto/create-demo-lead.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Role } from '../generated/prisma/client.js';

@Controller('demo-leads')
@UseGuards(RolesGuard)
export class DemoLeadsController {
  constructor(private demoLeadsService: DemoLeadsService) {}

  // No @Roles() — any authenticated user can submit. The frontend only ever shows the capture
  // form to someone logged into the shared demo account, but the endpoint itself doesn't need to
  // re-derive that (worst case, a real staff member submits their own name/email here once, which
  // is harmless — this is a lead list, not an access-control boundary).
  @Post()
  create(@Body() dto: CreateDemoLeadDto) {
    return this.demoLeadsService.create(dto.name, dto.email);
  }

  @Get()
  @Roles(Role.OWNER, Role.ADMIN)
  list() {
    return this.demoLeadsService.list();
  }
}
