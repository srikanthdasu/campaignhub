import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EmailCampaignsService } from './email-campaigns.service.js';
import { CreateEmailCampaignDto } from './dto/create-email-campaign.dto.js';
import { UpdateEmailCampaignDto } from './dto/update-email-campaign.dto.js';
import { BulkImportRecipientsDto } from './dto/bulk-import-recipients.dto.js';
import { ClientAccessGuard } from '../common/guards/client-access.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { EMAIL_CAMPAIGN_THROTTLE } from '../common/rate-limits.js';
import { Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

// Tighter than Campaigns' CAN_MANAGE (which also includes Creator/Designer) — a bad send here
// carries real reputational/compliance risk against the agency's own sending identity, so it's
// scoped to the roles who'd own that risk.
const CAN_MANAGE = [Role.OWNER, Role.ADMIN, Role.MANAGER];

@Controller('clients/:clientId/email-campaigns')
@UseGuards(ClientAccessGuard, RolesGuard)
export class EmailCampaignsController {
  constructor(private emailCampaigns: EmailCampaignsService) {}

  @Post()
  @Roles(...CAN_MANAGE)
  @Throttle(EMAIL_CAMPAIGN_THROTTLE)
  create(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEmailCampaignDto,
  ) {
    return this.emailCampaigns.create(clientId, user.sub, dto);
  }

  @Get()
  list(@Param('clientId') clientId: string) {
    return this.emailCampaigns.list(clientId);
  }

  @Get(':id')
  getOne(@Param('clientId') clientId: string, @Param('id') id: string) {
    return this.emailCampaigns.getOne(clientId, id);
  }

  @Patch(':id')
  @Roles(...CAN_MANAGE)
  update(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateEmailCampaignDto,
  ) {
    return this.emailCampaigns.update(clientId, id, user.sub, dto);
  }

  @Delete(':id')
  @Roles(...CAN_MANAGE)
  remove(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.emailCampaigns.remove(clientId, id, user.sub);
  }

  @Post(':id/recipients/bulk')
  @Roles(...CAN_MANAGE)
  @Throttle(EMAIL_CAMPAIGN_THROTTLE)
  bulkImportRecipients(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkImportRecipientsDto,
  ) {
    return this.emailCampaigns.bulkImportRecipients(clientId, id, user.sub, dto);
  }

  @Delete(':id/recipients/:recipientId')
  @Roles(...CAN_MANAGE)
  removeRecipient(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Param('recipientId') recipientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.emailCampaigns.removeRecipient(clientId, id, recipientId, user.sub);
  }

  @Post(':id/send')
  @Roles(...CAN_MANAGE)
  @Throttle(EMAIL_CAMPAIGN_THROTTLE)
  send(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.emailCampaigns.send(clientId, id, user.sub);
  }
}
