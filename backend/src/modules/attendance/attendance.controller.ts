import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PERMISSIONS } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AttendancePolicyService } from './attendance-policy.service';
import { ClassSessionsService } from './class-sessions.service';
import { StudentAttendanceService } from './student-attendance.service';
import { ExcusesService } from './excuses.service';
import { AttendanceReportsService } from './attendance-reports.service';
import {
  CancelSessionDto, CheckInDto, CreateSessionDto, ExcuseDto, ExcuseListDto, OpenCheckInDto, PolicyDto, ReportQuery, RevokeExcuseDto, SaveRegisterDto, UpdateSessionDto,
} from './dto/attendance.dto';

/** Lecturer attendance for a class they teach. Assignment is checked in the service. */
@Controller('teaching/classes/:id')
@RequirePermission(PERMISSIONS.TEACHING_READ)
export class ClassAttendanceController {
  constructor(private readonly sessions: ClassSessionsService) {}

  @Get('attendance')
  overview(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessions.overview(u, id);
  }

  @Post('sessions')
  create(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateSessionDto) {
    return this.sessions.create(u, id, dto);
  }

  @Patch('sessions/:sid')
  update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('sid', ParseUUIDPipe) sid: string, @Body() dto: UpdateSessionDto) {
    return this.sessions.update(u, id, sid, dto);
  }

  @Post('sessions/:sid/cancel') @HttpCode(200)
  cancel(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('sid', ParseUUIDPipe) sid: string, @Body() dto: CancelSessionDto) {
    return this.sessions.cancel(u, id, sid, dto.reason);
  }

  @Get('sessions/:sid/register')
  register(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('sid', ParseUUIDPipe) sid: string) {
    return this.sessions.register(u, id, sid);
  }

  @Put('sessions/:sid/register')
  saveRegister(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('sid', ParseUUIDPipe) sid: string, @Body() dto: SaveRegisterDto) {
    return this.sessions.saveRegister(u, id, sid, dto.entries);
  }

  @Post('sessions/:sid/check-in/open') @HttpCode(200)
  open(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('sid', ParseUUIDPipe) sid: string, @Body() dto: OpenCheckInDto) {
    return this.sessions.openCheckIn(u, id, sid, dto.minutes);
  }

  @Get('sessions/:sid/check-in')
  display(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('sid', ParseUUIDPipe) sid: string) {
    return this.sessions.checkInDisplay(u, id, sid);
  }

  @Post('sessions/:sid/check-in/close') @HttpCode(200)
  close(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('sid', ParseUUIDPipe) sid: string) {
    return this.sessions.closeCheckIn(u, id, sid);
  }
}

@Controller('me/attendance')
export class MyAttendanceController {
  constructor(private readonly attendance: StudentAttendanceService) {}

  @Get()
  mine(@CurrentUser() u: AuthUser) {
    return this.attendance.mine(u);
  }

  /** Limited per minute so codes cannot be guessed. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('check-in') @HttpCode(200)
  checkIn(@CurrentUser() u: AuthUser, @Body() dto: CheckInDto) {
    return this.attendance.checkIn(u, dto.code, dto.sessionId);
  }
}

@Controller('attendance')
export class AttendanceAdminController {
  constructor(
    private readonly policy: AttendancePolicyService,
    private readonly excuses: ExcusesService,
    private readonly reports: AttendanceReportsService,
  ) {}

  /** Anyone signed in can read the rules; students see the minimum on their page. */
  @Get('policy')
  getPolicy() {
    return this.policy.get();
  }

  @Put('policy') @RequirePermission(PERMISSIONS.ACADEMICS_MANAGE)
  setPolicy(@Body() dto: PolicyDto) {
    return this.policy.set(dto);
  }

  @Get('excuses') @RequirePermission(PERMISSIONS.ATTENDANCE_EXCUSES_MANAGE)
  listExcuses(@Query() q: ExcuseListDto) {
    return this.excuses.list(q);
  }

  @Post('excuses') @RequirePermission(PERMISSIONS.ATTENDANCE_EXCUSES_MANAGE)
  recordExcuse(@CurrentUser() u: AuthUser, @Body() dto: ExcuseDto) {
    return this.excuses.record(u, dto);
  }

  @Post('excuses/:id/revoke') @HttpCode(200) @RequirePermission(PERMISSIONS.ATTENDANCE_EXCUSES_MANAGE)
  revokeExcuse(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RevokeExcuseDto) {
    return this.excuses.revoke(u, id, dto.reason);
  }

  @Get('reports') @RequirePermission(PERMISSIONS.ATTENDANCE_REPORTS_READ)
  report(@CurrentUser() u: AuthUser, @Query() q: ReportQuery) {
    return this.reports.byCourse(u, q.semesterId);
  }

  @Get('reports/:offeringId') @RequirePermission(PERMISSIONS.ATTENDANCE_REPORTS_READ)
  courseReport(@CurrentUser() u: AuthUser, @Param('offeringId', ParseUUIDPipe) offeringId: string) {
    return this.reports.course(u, offeringId);
  }
}
