import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditService } from './audit.service.js';

// Hot data stays queryable in Postgres for this long; the composite dashboard/agency index added
// earlier this project degrades as the table grows unbounded, and AuditLog has real foreign keys
// to User/Agency, so unbounded growth can eventually block a legitimate account-deletion request
// downstream. Archival to blob storage beyond this window is a larger, separate feature — this
// closes the actual "grows forever" bug first.
const RETENTION_DAYS = 180;

@Injectable()
export class AuditCronService {
  private readonly logger = new Logger(AuditCronService.name);

  constructor(private auditService: AuditService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handlePurgeOldAuditLogs() {
    const count = await this.auditService.purgeOld(RETENTION_DAYS);
    if (count > 0) {
      this.logger.log(`Purged ${count} audit log entr${count === 1 ? 'y' : 'ies'} older than ${RETENTION_DAYS} days`);
    }
  }
}
