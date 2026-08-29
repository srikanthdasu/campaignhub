import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { CreateMemberDto } from './dto/create-member.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { UpdateActiveDto } from './dto/update-active.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

@Controller('users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findMe(user.sub);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(user.sub, dto);
  }

  @Get()
  @Roles(Role.OWNER, Role.ADMIN)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listForAgency(user.agencyId!);
  }

  @Post()
  @Roles(Role.OWNER, Role.ADMIN)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMemberDto) {
    return this.usersService.createMember(user.agencyId!, user.sub, dto);
  }

  @Patch(':id/role')
  @Roles(Role.OWNER, Role.ADMIN)
  updateRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') targetUserId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.usersService.updateRole(user.agencyId!, user.sub, targetUserId, dto.role);
  }

  @Patch(':id/active')
  @Roles(Role.OWNER, Role.ADMIN)
  setActive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') targetUserId: string,
    @Body() dto: UpdateActiveDto,
  ) {
    return this.usersService.setActive(user.agencyId!, user.sub, targetUserId, dto.isActive);
  }
}
