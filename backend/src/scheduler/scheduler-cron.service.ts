import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service.js';

// This is the "Supporting Systems" background worker the book describes — the app keeps
// publishing scheduled content on time even with no browser tab open. It runs in-process
// (no separate queue/worker infra) since a single NestJS instance is all this deployment has;
// swapping in BullMQ + a real publish job later means replacing this cron trigger, not the
// SchedulerService logic it calls.
@Injectable()
export class SchedulerCronService {
  private readonly logger = new Logger(SchedulerCronService.name);
  // A single NestJS instance runs this, so an in-memory flag is enough: without it, a slow
  // publish run (a real backlog after downtime, or a slow external API) could still be mid-loop
  // when the next EVERY_MINUTE tick fires, doubling up work on the same due posts.
  private isRunning = false;

  constructor(private schedulerService: SchedulerService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handlePublishDuePosts() {
    if (this.isRunning) {
      this.logger.warn('Skipping this tick — the previous publish run is still in progress');
      return;
    }
    this.isRunning = true;
    try {
      const count = await this.schedulerService.autoPublishDuePosts();
      if (count > 0) {
        this.logger.log(`Auto-published ${count} scheduled post(s)`);
      }
    } finally {
      this.isRunning = false;
    }
  }
}
