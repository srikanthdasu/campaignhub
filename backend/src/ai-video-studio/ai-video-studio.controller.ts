import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AiVideoStudioService } from './ai-video-studio.service.js';
import { CreateVideoProjectDto } from './dto/create-video-project.dto.js';
import { GenerateScriptDto } from './dto/generate-script.dto.js';
import { UpdateStoryboardDto } from './dto/update-storyboard.dto.js';
import { UpdateAssetsDto } from './dto/update-assets.dto.js';
import { UpdateEnhancementsDto } from './dto/update-enhancements.dto.js';
import { ExportVideoDto } from './dto/export-video.dto.js';
import { ClientAccessGuard } from '../common/guards/client-access.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const CAN_CREATE = [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.CREATOR, Role.DESIGNER];

@Controller('clients/:clientId/ai-video-studio/projects')
@UseGuards(ClientAccessGuard, RolesGuard)
export class AiVideoStudioController {
  constructor(private aiVideoStudioService: AiVideoStudioService) {}

  @Post()
  @Roles(...CAN_CREATE)
  create(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVideoProjectDto,
  ) {
    return this.aiVideoStudioService.create(clientId, user.sub, dto);
  }

  @Get()
  list(@Param('clientId') clientId: string) {
    return this.aiVideoStudioService.list(clientId);
  }

  @Get(':id')
  getOne(@Param('clientId') clientId: string, @Param('id') id: string) {
    return this.aiVideoStudioService.getOne(clientId, id);
  }

  @Post(':id/script')
  @Roles(...CAN_CREATE)
  generateScript(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body() dto: GenerateScriptDto,
  ) {
    return this.aiVideoStudioService.generateScript(clientId, id, dto);
  }

  @Post(':id/storyboard')
  @Roles(...CAN_CREATE)
  updateStoryboard(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStoryboardDto,
  ) {
    return this.aiVideoStudioService.updateStoryboard(clientId, id, dto);
  }

  @Post(':id/assets')
  @Roles(...CAN_CREATE)
  updateAssets(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAssetsDto,
  ) {
    return this.aiVideoStudioService.updateAssets(clientId, id, dto);
  }

  @Post(':id/enhancements')
  @Roles(...CAN_CREATE)
  updateEnhancements(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEnhancementsDto,
  ) {
    return this.aiVideoStudioService.updateEnhancements(clientId, id, dto);
  }

  @Post(':id/render')
  @Roles(...CAN_CREATE)
  render(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aiVideoStudioService.render(clientId, id, user.sub);
  }

  @Post(':id/export')
  @Roles(...CAN_CREATE)
  export(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ExportVideoDto,
  ) {
    return this.aiVideoStudioService.export(clientId, id, user.sub, dto);
  }

  @Post(':id/publish')
  @Roles(...CAN_CREATE)
  publish(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aiVideoStudioService.publish(clientId, id, user.sub);
  }

  @Delete(':id')
  @Roles(...CAN_CREATE)
  remove(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aiVideoStudioService.remove(clientId, id, user.sub);
  }
}
