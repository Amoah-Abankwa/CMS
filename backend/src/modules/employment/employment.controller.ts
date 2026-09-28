import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { PERMISSIONS } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { EmploymentRulesService } from './employment-rules.service';
import { JobsService } from './jobs.service';
import { DispatchersService } from './dispatchers.service';
import { ApplyDto, DecisionDto, DispatcherApplyDto, DispatcherListQuery, DispatcherReviewDto, EmploymentRulesDto, JobDto, JobStatusDto } from './dto/employment.dto';

/** Career Services and the Dean of Students office. */
@Controller('employment')
@RequirePermission(PERMISSIONS.EMPLOYMENT_MANAGE)
export class EmploymentAdminController {
  constructor(
    private readonly rules: EmploymentRulesService,
    private readonly jobs: JobsService,
    private readonly dispatchers: DispatchersService,
  ) {}

  @Get('rules')
  getRules() {
    return this.rules.get();
  }

  @Put('rules')
  setRules(@Body() dto: EmploymentRulesDto) {
    return this.rules.set(dto);
  }

  @Get('jobs')
  list() {
    return this.jobs.list();
  }

  @Post('jobs')
  create(@CurrentUser() u: AuthUser, @Body() dto: JobDto) {
    return this.jobs.save(u, dto);
  }

  @Patch('jobs/:id')
  update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: JobDto) {
    return this.jobs.save(u, dto, id);
  }

  @Post('jobs/:id/status') @HttpCode(200)
  status(@Param('id', ParseUUIDPipe) id: string, @Body() dto: JobStatusDto) {
    return this.jobs.setStatus(id, dto.status);
  }

  @Get('jobs/:id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.detail(id);
  }

  @Post('applications/:id/decision') @HttpCode(200)
  decide(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto) {
    return this.jobs.decide(u, id, dto);
  }

  @Get('dispatchers')
  dispatcherList(@Query() q: DispatcherListQuery) {
    return this.dispatchers.list(q.status);
  }

  @Post('dispatchers/:id/review') @HttpCode(200)
  review(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DispatcherReviewDto) {
    return this.dispatchers.review(u, id, dto);
  }
}

/** A student's own view: open jobs, applications, and the dispatcher programme. */
@Controller('me/work')
export class MyWorkController {
  constructor(
    private readonly jobs: JobsService,
    private readonly dispatchers: DispatchersService,
  ) {}

  @Get('jobs')
  open(@CurrentUser() u: AuthUser) {
    return this.jobs.openJobs(u);
  }

  @Get('jobs/:id')
  job(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.job(u, id);
  }

  @Post('jobs/:id/apply')
  apply(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ApplyDto) {
    return this.jobs.apply(u, id, dto);
  }

  @Post('applications/:id/withdraw') @HttpCode(200)
  withdraw(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.withdraw(u, id);
  }

  @Get('dispatcher')
  dispatcher(@CurrentUser() u: AuthUser) {
    return this.dispatchers.mine(u);
  }

  @Post('dispatcher')
  applyDispatcher(@CurrentUser() u: AuthUser, @Body() dto: DispatcherApplyDto) {
    return this.dispatchers.apply(u, dto);
  }

  @Put('dispatcher/payout')
  payout(@CurrentUser() u: AuthUser, @Body() dto: DispatcherApplyDto) {
    return this.dispatchers.updatePayout(u, dto);
  }
}
