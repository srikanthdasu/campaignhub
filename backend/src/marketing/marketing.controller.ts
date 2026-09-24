import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MarketingService } from './marketing.service.js';
import { RequestDemoDto } from './dto/request-demo.dto.js';
import { Public } from '../common/decorators/public.decorator.js';
import { MARKETING_CONTACT_THROTTLE } from '../common/rate-limits.js';

@Controller('marketing')
export class MarketingController {
  constructor(private marketingService: MarketingService) {}

  @Public()
  @Throttle(MARKETING_CONTACT_THROTTLE)
  @Post('request-demo')
  @HttpCode(HttpStatus.OK)
  async requestDemo(@Body() dto: RequestDemoDto) {
    return this.marketingService.requestDemo(dto.name, dto.email, dto.agencyName, dto.message);
  }
}
