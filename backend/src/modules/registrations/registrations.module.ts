import { AdvisorsController } from './advisors.controller';
import { AdvisorsService } from './advisors.service';
import { Module } from '@nestjs/common';
import { MyRegistrationController, RegistrationReviewController } from './registrations.controller';
import { StudentRegistrationService } from './student-registration.service';
import { RegistrationReviewService } from './registration-review.service';

@Module({
  controllers: [AdvisorsController, MyRegistrationController, RegistrationReviewController],
  providers: [AdvisorsService, StudentRegistrationService, RegistrationReviewService],
})
export class RegistrationsModule {}
