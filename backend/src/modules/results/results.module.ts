import { Module } from '@nestjs/common';
import { OfferingsModule } from '../offerings/offerings.module';
import { GradingController, MarksController, MyResultsController, ResultSheetsController } from './results.controller';
import { GradingService } from './grading.service';
import { MarksService } from './marks.service';
import { ResultApprovalsService } from './result-approvals.service';
import { StudentResultsService } from './student-results.service';

@Module({
  imports: [OfferingsModule],
  controllers: [GradingController, MarksController, ResultSheetsController, MyResultsController],
  providers: [GradingService, MarksService, ResultApprovalsService, StudentResultsService],
})
export class ResultsModule {}
