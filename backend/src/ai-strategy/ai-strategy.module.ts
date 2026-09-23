import { Module } from '@nestjs/common';
import { AiStrategyService } from './ai-strategy.service.js';
import { AiStrategyController } from './ai-strategy.controller.js';
import { AuditModule } from '../audit/audit.module.js';
import { AiCommonModule } from '../ai-common/ai-common.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [AuditModule, AiCommonModule, NotificationsModule],
  controllers: [AiStrategyController],
  providers: [AiStrategyService],
})
export class AiStrategyModule {}
