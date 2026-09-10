import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientsService } from './clients.service.js';

// A soft-deleted client (see ClientsService.softDelete) is recoverable for this many days —
// matches the plan's grace-period policy: only purge for good once nobody has come back to
// restore or upgrade within the window.
const GRACE_PERIOD_DAYS = 15;

@Injectable()
export class ClientsCronService {
  private readonly logger = new Logger(ClientsCronService.name);

  constructor(private clientsService: ClientsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handlePurgeExpiredClients() {
    const count = await this.clientsService.purgeExpired(GRACE_PERIOD_DAYS);
    if (count > 0) {
      this.logger.log(`Permanently purged ${count} client(s) past the ${GRACE_PERIOD_DAYS}-day grace period`);
    }
  }
}
