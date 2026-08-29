import { Module } from '@nestjs/common';
import { BrandKitService } from './brand-kit.service.js';
import { BrandKitController } from './brand-kit.controller.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [BrandKitController],
  providers: [BrandKitService],
})
export class BrandKitModule {}
