import { Module } from '@nestjs/common';
import { AiStrategyService } from './ai-strategy.service.js';
import { AiStrategyController } from './ai-strategy.controller.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [AiStrategyController],
  providers: [AiStrategyService],
})
export class AiStrategyModule {}
