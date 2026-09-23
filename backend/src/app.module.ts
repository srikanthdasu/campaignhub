import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { SentryModule, SentryGlobalFilter } from '@sentry/nestjs/setup';
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
import { AiAssistantModule } from './ai-assistant/ai-assistant.module.js';
import { AiCaptionsModule } from './ai-captions/ai-captions.module.js';
import { AiVideoStudioModule } from './ai-video-studio/ai-video-studio.module.js';
import { AiStrategyModule } from './ai-strategy/ai-strategy.module.js';
import { CampaignsModule } from './campaigns/campaigns.module.js';
import { EmailCampaignsModule } from './email-campaigns/email-campaigns.module.js';
import { AdsModule } from './ads/ads.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { BillingModule } from './billing/billing.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { DemoLeadsModule } from './demo-leads/demo-leads.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { AppController } from './app.controller.js';
import { validateEnv } from './config/validate-env.js';

@Module({
  imports: [
    // Must be the first import — see Sentry's NestJS integration docs. No-ops safely when
    // SENTRY_DSN isn't set (instrument.ts skips Sentry.init entirely in that case).
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    // App-wide default of 60 requests/minute per IP; individual routes tighten this further
    // with @Throttle() (see common/rate-limits.ts) for brute-forceable or billable AI endpoints.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),
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
    AiAssistantModule,
    AiCaptionsModule,
    AiVideoStudioModule,
    AiStrategyModule,
    CampaignsModule,
    EmailCampaignsModule,
    AdsModule,
    NotificationsModule,
    BillingModule,
    AnalyticsModule,
    DashboardModule,
    DemoLeadsModule,
  ],
  controllers: [AppController],
  providers: [
    // Must be the first provider — Sentry's own requirement, so it wraps every other exception
    // filter and reliably reports unhandled errors before Nest's default handling takes over.
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
