import { CourseDropsController, MalpracticeController, MyDropsController, RegistrationRecordsController } from './course-drops.controller';
import { CourseDropsService } from './course-drops.service';
import { AdvisorsController } from './advisors.controller';
import { AdvisorsService } from './advisors.service';
import { Module } from '@nestjs/common';
import { MyRegistrationController, RegistrationReviewController } from './registrations.controller';
import { StudentRegistrationService } from './student-registration.service';
import { RegistrationReviewService } from './registration-review.service';

@Module({
  controllers: [MyDropsController, CourseDropsController, RegistrationRecordsController, MalpracticeController, AdvisorsController, MyRegistrationController, RegistrationReviewController],
  providers: [CourseDropsService, AdvisorsService, StudentRegistrationService, RegistrationReviewService],
})
export class RegistrationsModule {}
