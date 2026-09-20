import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EmailCampaignsService } from './email-campaigns.service.js';
import { UnsubscribeDto } from './dto/unsubscribe.dto.js';
import { Public } from '../common/decorators/public.decorator.js';
import { EMAIL_CAMPAIGN_THROTTLE } from '../common/rate-limits.js';

// Deliberately NOT nested under clients/:clientId and NOT guarded — someone clicking this from
// their inbox isn't logged in. The token in the URL is what identifies them (same pattern as
// AuthController's verify-email route). GET only looks up who the link is for and never mutates
// state, since email clients/security scanners are known to pre-fetch links — a single GET click
// silently unsubscribing everyone would be a real bug. Only the POST, from an explicit "Confirm"
// button, actually unsubscribes.
@Controller('email-campaigns/unsubscribe')
export class UnsubscribeController {
  constructor(private emailCampaigns: EmailCampaignsService) {}

  @Public()
  @Throttle(EMAIL_CAMPAIGN_THROTTLE)
  @Get()
  async lookup(@Query('token') token: string) {
    const recipient = await this.emailCampaigns.findByUnsubscribeToken(token);
    return { email: recipient.email, clientName: recipient.campaign.client.name };
  }

  @Public()
  @Throttle(EMAIL_CAMPAIGN_THROTTLE)
  @Post()
  confirm(@Body() dto: UnsubscribeDto) {
    return this.emailCampaigns.confirmUnsubscribe(dto.token);
  }
}
