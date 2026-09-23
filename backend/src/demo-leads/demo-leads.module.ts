import { Module } from '@nestjs/common';
import { DemoLeadsService } from './demo-leads.service.js';
import { DemoLeadsController } from './demo-leads.controller.js';

@Module({
  controllers: [DemoLeadsController],
  providers: [DemoLeadsService],
})
export class DemoLeadsModule {}
