import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './core/prisma/prisma.module';
import { JobsModule } from './core/jobs/jobs.module';
import { RequestContextMiddleware } from './core/context/request-context.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { StudentsModule } from './modules/students/students.module';
import { StaffModule } from './modules/staff/staff.module';
import { OfferingsModule } from './modules/offerings/offerings.module';
import { RegistrationsModule } from './modules/registrations/registrations.module';
import { ResultsModule } from './modules/results/results.module';
import { ExamsModule } from './modules/exams/exams.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { DevotionModule } from './modules/devotion/devotion.module';
import { AccommodationModule } from './modules/accommodation/accommodation.module';
import { LibraryModule } from './modules/library/library.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { AccountSetupModule } from './modules/account-setup/account-setup.module';
import { PreferencesModule } from './modules/preferences/preferences.module';
import { AcademicsModule } from './modules/academics/academics.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    JobsModule,
    AuditModule,
    NotificationsModule,
    RbacModule,
    AuthModule,
    AccountSetupModule,
    StudentsModule,
    StaffModule,
    OfferingsModule,
    RegistrationsModule,
    ResultsModule,
    ExamsModule,
    AttendanceModule,
    DevotionModule,
    AccommodationModule,
    LibraryModule,
    PaymentsModule,
    MarketplaceModule,
    AcademicsModule,
    PreferencesModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('{*splat}');
  }
}
