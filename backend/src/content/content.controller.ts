import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ContentService } from './content.service.js';
import { CreateContentDto } from './dto/create-content.dto.js';
import { UpdateContentDto } from './dto/update-content.dto.js';
import { SubmitContentDto } from './dto/submit-content.dto.js';
import { ClientAccessGuard } from '../common/guards/client-access.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ContentStatus, Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const CAN_CREATE_CONTENT = [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.CREATOR, Role.DESIGNER];

@Controller('clients/:clientId/content')
@UseGuards(ClientAccessGuard, RolesGuard)
export class ContentController {
  constructor(private contentService: ContentService) {}

  @Post()
  @Roles(...CAN_CREATE_CONTENT)
  create(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateContentDto,
  ) {
    return this.contentService.create(clientId, user, dto);
  }

  @Get()
  list(@Param('clientId') clientId: string, @Query('status') status?: ContentStatus) {
    return this.contentService.list(clientId, status);
  }

  @Get(':id')
  getOne(@Param('clientId') clientId: string, @Param('id') id: string) {
    return this.contentService.getOne(clientId, id);
  }

  @Patch(':id')
  @Roles(...CAN_CREATE_CONTENT)
  update(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateContentDto,
  ) {
    return this.contentService.update(clientId, id, user, dto);
  }

  @Delete(':id')
  @Roles(...CAN_CREATE_CONTENT)
  remove(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contentService.remove(clientId, id, user);
  }

  @Post(':id/submit')
  @Roles(...CAN_CREATE_CONTENT)
  submit(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitContentDto,
  ) {
    return this.contentService.submit(clientId, id, user, dto);
  }
}
