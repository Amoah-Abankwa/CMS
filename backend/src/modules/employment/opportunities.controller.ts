import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PERMISSIONS } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DecisionDto, JobDto, PayoutDetailsDto, TimesheetDto } from './dto/employment.dto';
import { JobsService } from './jobs.service';
import { TimesheetsService } from './timesheets.service';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
class PeriodDto { @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) period: string; }
class ReviewDto { @IsBoolean() approve: boolean; @Transform(trim) @IsOptional() @IsString() @MaxLength(300) note?: string; }
class PaidDto { @Transform(trim) @IsString() @MinLength(3) @MaxLength(60) reference: string; }
class PayrollQuery { @IsOptional() @IsIn(['APPROVED', 'PAID']) status?: 'APPROVED' | 'PAID'; }

function sendPdf(res: Response, file: { filename: string; buffer: Buffer }) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename.replace(/[^\w.-]/g, '-')}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(file.buffer);
}

/** Staff and lecturers' own postings, and timesheets they supervise. Ownership is checked in the services. */
@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly jobs: JobsService, private readonly timesheets: TimesheetsService) {}
  @Get() mine(@CurrentUser() u: AuthUser) { return this.jobs.myPostings(u); }
  @Post() post(@CurrentUser() u: AuthUser, @Body() dto: JobDto) { return this.jobs.post(u, dto); }
  @Put(':id') update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: JobDto) { return this.jobs.post(u, dto, id); }
  @Post(':id/close') @HttpCode(200) close(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.jobs.ownerClose(u, id); }
  @Get('jobs/:id') detail(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.jobs.ownerDetail(u, id); }
  @Post('applications/:id/decision') @HttpCode(200) decide(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto) { return this.jobs.ownerDecide(u, id, dto); }
  @Get('timesheets') toApprove(@CurrentUser() u: AuthUser) { return this.timesheets.toApprove(u); }
  @Post('timesheets/:id/review') @HttpCode(200) review(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDto) { return this.timesheets.review(u, id, dto.approve, dto.note); }
  @Get('timesheets/:id/payslip') async payslip(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) { sendPdf(res, await this.timesheets.payslip(u, id)); }
}

/** A student's paid work: payout number, monthly timesheets. */
@Controller('me/timesheets')
export class MyTimesheetsController {
  constructor(private readonly timesheets: TimesheetsService) {}
  @Get() mine(@CurrentUser() u: AuthUser) { return this.timesheets.mine(u); }
  @Post('jobs/:applicationId/payout') @HttpCode(200) payout(@CurrentUser() u: AuthUser, @Param('applicationId', ParseUUIDPipe) id: string, @Body() dto: PayoutDetailsDto) { return this.timesheets.setPayout(u, id, dto); }
  @Post('jobs/:applicationId/open') @HttpCode(200) open(@CurrentUser() u: AuthUser, @Param('applicationId', ParseUUIDPipe) id: string, @Body() dto: PeriodDto) { return this.timesheets.open(u, id, dto.period); }
  @Put(':id') save(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TimesheetDto) { return this.timesheets.saveEntries(u, id, dto); }
  @Post(':id/submit') @HttpCode(200) submit(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.timesheets.submit(u, id); }
}

@Controller('payroll')
@RequirePermission(PERMISSIONS.PAYROLL_MANAGE)
export class PayrollController {
  constructor(private readonly timesheets: TimesheetsService) {}
  @Get() list(@Query() q: PayrollQuery) { return this.timesheets.payroll(q.status ?? 'APPROVED'); }
  @Post(':id/paid') @HttpCode(200) paid(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PaidDto) { return this.timesheets.markPaid(u, id, dto.reference); }
}
