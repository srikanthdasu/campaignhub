import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ClientEmailSenderService } from './client-email-sender.service.js';
import { UpsertClientEmailSenderDto } from './dto/upsert-client-email-sender.dto.js';
import { ClientAccessGuard } from '../common/guards/client-access.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

// Sender/domain setup is infrastructure, not campaign drafting — same CAN_MANAGE tier as
// EmailCampaignsController's delete/send (CLIENT can draft and request a send, but configuring
// what the campaigns actually send *as* stays an agency-staff action).
const CAN_MANAGE = [Role.OWNER, Role.ADMIN, Role.MANAGER];

@Controller('clients/:clientId/email-sender')
@UseGuards(ClientAccessGuard, RolesGuard)
export class ClientEmailSenderController {
  constructor(private clientEmailSender: ClientEmailSenderService) {}

  @Get()
  @Roles(...CAN_MANAGE)
  get(@Param('clientId') clientId: string) {
    return this.clientEmailSender.getForClient(clientId);
  }

  @Put()
  @Roles(...CAN_MANAGE)
  upsert(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertClientEmailSenderDto,
  ) {
    return this.clientEmailSender.upsert(clientId, user.sub, dto);
  }

  @Post('verify')
  @Roles(...CAN_MANAGE)
  checkVerification(@Param('clientId') clientId: string) {
    return this.clientEmailSender.checkVerification(clientId);
  }
}
