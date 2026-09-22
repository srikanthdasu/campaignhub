import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthService } from './auth.service.js';

@Injectable()
export class AuthCronService {
  private readonly logger = new Logger(AuthCronService.name);

  constructor(private authService: AuthService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handlePurgeExpiredRefreshTokens() {
    const count = await this.authService.purgeExpiredRefreshTokens();
    if (count > 0) {
      this.logger.log(`Purged ${count} expired/revoked refresh token(s)`);
    }
  }
}
