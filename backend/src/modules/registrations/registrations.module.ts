import { Module } from '@nestjs/common';
import { MyRegistrationController, RegistrationReviewController } from './registrations.controller';
import { StudentRegistrationService } from './student-registration.service';
import { RegistrationReviewService } from './registration-review.service';

@Module({
  controllers: [MyRegistrationController, RegistrationReviewController],
  providers: [StudentRegistrationService, RegistrationReviewService],
})
export class RegistrationsModule {}
