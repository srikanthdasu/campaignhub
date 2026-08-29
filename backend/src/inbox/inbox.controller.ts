import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { InboxService } from './inbox.service.js';
import { SimulateMessageDto } from './dto/simulate-message.dto.js';
import { ReplyMessageDto } from './dto/reply-message.dto.js';
import { ClientAccessGuard } from '../common/guards/client-access.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

@Controller('clients/:clientId/inbox')
@UseGuards(ClientAccessGuard)
export class InboxController {
  constructor(private inboxService: InboxService) {}

  @Post('simulate')
  simulate(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SimulateMessageDto,
  ) {
    return this.inboxService.simulate(clientId, user.sub, dto);
  }

  @Get()
  list(@Param('clientId') clientId: string, @Query('unread') unread?: string) {
    return this.inboxService.list(clientId, unread === 'true');
  }

  @Patch(':id/read')
  markRead(@Param('clientId') clientId: string, @Param('id') id: string) {
    return this.inboxService.markRead(clientId, id);
  }

  @Post(':id/reply')
  reply(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReplyMessageDto,
  ) {
    return this.inboxService.reply(clientId, id, user, dto.reply);
  }
}
