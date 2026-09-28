import { ExamRegisterController } from './exam-register.controller';
import { ExamRegisterService } from './exam-register.service';
import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { ClearanceController, ExamsController, HoldsController, MyExamsController } from './exams.controller';
import { VenuesService } from './venues.service';
import { TimetableService } from './timetable.service';
import { ClearanceService } from './clearance.service';
import { HoldsService } from './holds.service';
import { EligibilityService } from './eligibility.service';
import { StudentExamsService } from './student-exams.service';

@Module({
  imports: [AttendanceModule],
  controllers: [ExamRegisterController, ExamsController, ClearanceController, HoldsController, MyExamsController],
  providers: [ExamRegisterService, VenuesService, TimetableService, ClearanceService, HoldsService, EligibilityService, StudentExamsService],
})
export class ExamsModule {}
