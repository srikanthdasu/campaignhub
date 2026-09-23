import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientsService } from './clients.service.js';

// A soft-deleted client (see ClientsService.softDelete) is recoverable for this many days —
// matches the plan's grace-period policy: only purge for good once nobody has come back to
// restore or upgrade within the window.
const GRACE_PERIOD_DAYS = 15;

// NOTIF-1: warn agency Owners/Admins this many days before a soft-deleted client is permanently
// purged, so the 15-day window doesn't silently expire with nobody told.
const WARNING_DAYS_BEFORE_PURGE = 3;

@Injectable()
export class ClientsCronService {
  private readonly logger = new Logger(ClientsCronService.name);

  constructor(private clientsService: ClientsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleWarnBeforePurge() {
    const count = await this.clientsService.warnBeforePurge(GRACE_PERIOD_DAYS, WARNING_DAYS_BEFORE_PURGE);
    if (count > 0) {
      this.logger.log(`Warned owners/admins for ${count} client(s) ${WARNING_DAYS_BEFORE_PURGE} day(s) from permanent purge`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handlePurgeExpiredClients() {
    const count = await this.clientsService.purgeExpired(GRACE_PERIOD_DAYS);
    if (count > 0) {
      this.logger.log(`Permanently purged ${count} client(s) past the ${GRACE_PERIOD_DAYS}-day grace period`);
    }
  }
}
