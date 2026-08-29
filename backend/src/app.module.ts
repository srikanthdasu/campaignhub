import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { AgenciesModule } from './agencies/agencies.module.js';
import { ClientsModule } from './clients/clients.module.js';
import { AuditModule } from './audit/audit.module.js';
import { BrandKitModule } from './brand-kit/brand-kit.module.js';
import { MediaModule } from './media/media.module.js';
import { ApprovalsModule } from './approvals/approvals.module.js';
import { ContentModule } from './content/content.module.js';
import { SchedulerModule } from './scheduler/scheduler.module.js';
import { SocialAccountsModule } from './social-accounts/social-accounts.module.js';
import { InboxModule } from './inbox/inbox.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { AppController } from './app.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    AgenciesModule,
    ClientsModule,
    AuditModule,
    BrandKitModule,
    MediaModule,
    ApprovalsModule,
    ContentModule,
    SchedulerModule,
    SocialAccountsModule,
    InboxModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
