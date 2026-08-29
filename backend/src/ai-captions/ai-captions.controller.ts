import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AiCaptionsService } from './ai-captions.service.js';
import { GenerateCaptionsDto } from './dto/generate-captions.dto.js';
import { SaveCaptionDto } from './dto/save-caption.dto.js';
import { ClientAccessGuard } from '../common/guards/client-access.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const CAN_CREATE = [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.CREATOR, Role.DESIGNER];

@Controller('clients/:clientId/ai-captions')
@UseGuards(ClientAccessGuard, RolesGuard)
export class AiCaptionsController {
  constructor(private aiCaptionsService: AiCaptionsService) {}

  @Post('generate')
  @Roles(...CAN_CREATE)
  generate(@Body() dto: GenerateCaptionsDto) {
    return this.aiCaptionsService.generate(dto);
  }

  @Post()
  @Roles(...CAN_CREATE)
  save(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveCaptionDto,
  ) {
    return this.aiCaptionsService.save(clientId, user.sub, dto);
  }

  @Get()
  list(@Param('clientId') clientId: string) {
    return this.aiCaptionsService.list(clientId);
  }

  @Delete(':id')
  @Roles(...CAN_CREATE)
  remove(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aiCaptionsService.remove(clientId, id, user.sub);
  }
}
