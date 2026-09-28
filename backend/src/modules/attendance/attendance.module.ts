import { ExcuseRequestsController, MyExcuseRequestsController } from './excuse-requests.controller';
import { ExcuseRequestsService } from './excuse-requests.service';
import { Module } from '@nestjs/common';
import { OfferingsModule } from '../offerings/offerings.module';
import { AttendanceAdminController, ClassAttendanceController, MyAttendanceController } from './attendance.controller';
import { AttendancePolicyService } from './attendance-policy.service';
import { AttendanceSummaryService } from './attendance-summary.service';
import { ClassSessionsService } from './class-sessions.service';
import { StudentAttendanceService } from './student-attendance.service';
import { ExcusesService } from './excuses.service';
import { AttendanceReportsService } from './attendance-reports.service';

@Module({
  imports: [OfferingsModule],
  controllers: [ExcuseRequestsController, MyExcuseRequestsController, ClassAttendanceController, MyAttendanceController, AttendanceAdminController],
  providers: [ExcuseRequestsService, AttendancePolicyService, AttendanceSummaryService, ClassSessionsService, StudentAttendanceService, ExcusesService, AttendanceReportsService],
  exports: [AttendancePolicyService, AttendanceSummaryService],
})
export class AttendanceModule {}
