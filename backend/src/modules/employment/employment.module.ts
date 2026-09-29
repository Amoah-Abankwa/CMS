import { MyTimesheetsController, OpportunitiesController, PayrollController } from './opportunities.controller';
import { TimesheetsService } from './timesheets.service';
import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { JobsService as QueueService, QUEUES } from '../../core/jobs/jobs.service';
import { EmploymentAdminController, MyWorkController } from './employment.controller';
import { EmploymentRulesService } from './employment-rules.service';
import { EligibilityService } from './eligibility.service';
import { JobsService } from './jobs.service';
import { DispatchersService } from './dispatchers.service';

@Module({
  controllers: [OpportunitiesController, MyTimesheetsController, PayrollController, EmploymentAdminController, MyWorkController],
  providers: [TimesheetsService, EmploymentRulesService, EligibilityService, JobsService, DispatchersService],
  exports: [EmploymentRulesService, EligibilityService],
})
export class EmploymentModule implements OnModuleInit {
  private readonly logger = new Logger(EmploymentModule.name);

  constructor(
    private readonly queue: QueueService,
    private readonly jobs: JobsService,
    private readonly dispatchers: DispatchersService,
  ) {}

  /** Daily at 05:00: close jobs past their date, and suspend dispatchers who no longer meet the rules. */
  async onModuleInit() {
    await this.queue.work(QUEUES.EMPLOYMENT_DAILY, async () => {
      const closed = await this.jobs.closeExpired();
      const suspended = await this.dispatchers.sweep();
      if (closed || suspended) this.logger.log(`Closed ${closed} jobs, suspended ${suspended} dispatchers`);
    });
    await this.queue.schedule(QUEUES.EMPLOYMENT_DAILY, '0 5 * * *');
  }
}
