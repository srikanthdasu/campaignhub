import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ClientsService } from './clients.service.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';
import { GrantAccessDto } from './dto/grant-access.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { ClientAccessGuard } from '../common/guards/client-access.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

@Controller('clients')
@UseGuards(RolesGuard)
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Post()
  @Roles(Role.OWNER, Role.ADMIN)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClientDto) {
    return this.clientsService.create(user.agencyId!, user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.clientsService.listForUser(user);
  }

  @Get(':id')
  @UseGuards(ClientAccessGuard)
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.OWNER, Role.ADMIN)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(user.agencyId!, user.sub, id, dto);
  }

  @Get(':id/access')
  @Roles(Role.OWNER, Role.ADMIN)
  listAccess(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.clientsService.listAccess(user.agencyId!, id);
  }

  @Post(':id/access')
  @Roles(Role.OWNER, Role.ADMIN)
  grantAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: GrantAccessDto,
  ) {
    return this.clientsService.grantAccess(user.agencyId!, user.sub, id, dto.userId);
  }

  @Delete(':id/access/:userId')
  @Roles(Role.OWNER, Role.ADMIN)
  revokeAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.clientsService.revokeAccess(user.agencyId!, user.sub, id, userId);
  }
}
