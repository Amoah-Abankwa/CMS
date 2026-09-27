import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { PERMISSIONS } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { VenuesService } from './venues.service';
import { TimetableService } from './timetable.service';
import { ClearanceService } from './clearance.service';
import { HoldsService } from './holds.service';
import { EligibilityService } from './eligibility.service';
import { StudentExamsService } from './student-exams.service';
import {
  BulkClearanceDto, ClearanceListDto, EligibilityListDto, HoldDto, LiftHoldDto, OverrideDto, PolicyDto, SemesterParam, SessionDto, VenueDto,
} from './dto/exams.dto';

@Controller('exams')
export class ExamsController {
  constructor(
    private readonly venues: VenuesService,
    private readonly timetable: TimetableService,
    private readonly eligibility: EligibilityService,
  ) {}

  // Venues
  @Get('venues') @RequirePermission(PERMISSIONS.EXAMS_MANAGE)
  listVenues() {
    return this.venues.list();
  }

  @Post('venues') @RequirePermission(PERMISSIONS.EXAMS_MANAGE)
  createVenue(@Body() dto: VenueDto) {
    return this.venues.save(dto);
  }

  @Patch('venues/:id') @RequirePermission(PERMISSIONS.EXAMS_MANAGE)
  updateVenue(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VenueDto) {
    return this.venues.save(dto, id);
  }

  // Timetable
  @Get('timetable') @RequirePermission(PERMISSIONS.EXAMS_MANAGE)
  getTimetable(@Query() q: SemesterParam) {
    return this.timetable.overview(q.semesterId);
  }

  @Get('invigilator-options') @RequirePermission(PERMISSIONS.EXAMS_MANAGE)
  invigilators() {
    return this.timetable.invigilatorOptions();
  }

  @Put('timetable/papers') @RequirePermission(PERMISSIONS.EXAMS_MANAGE)
  savePaper(@Body() dto: SessionDto) {
    return this.timetable.saveSession(dto);
  }

  @Delete('timetable/papers/:id') @RequirePermission(PERMISSIONS.EXAMS_MANAGE)
  removePaper(@Param('id', ParseUUIDPipe) id: string) {
    return this.timetable.removeSession(id);
  }

  @Post('timetable/publish') @HttpCode(200) @RequirePermission(PERMISSIONS.EXAMS_MANAGE)
  publishTimetable(@Body() dto: SemesterParam) {
    return this.timetable.publish(dto.semesterId);
  }

  // Eligibility
  @Get('eligibility') @RequirePermission(PERMISSIONS.EXAMS_MANAGE)
  listEligibility(@Query() q: EligibilityListDto) {
    return this.eligibility.list(q);
  }

  @Put('eligibility/policy') @RequirePermission(PERMISSIONS.EXAMS_MANAGE)
  setPolicy(@Body() dto: PolicyDto) {
    return this.eligibility.setPolicy(dto);
  }

  @Post('eligibility/generate') @HttpCode(200) @RequirePermission(PERMISSIONS.EXAMS_MANAGE)
  generate(@Body() dto: SemesterParam) {
    return this.eligibility.generate(dto.semesterId);
  }

  @Post('eligibility/publish') @HttpCode(200) @RequirePermission(PERMISSIONS.EXAMS_MANAGE)
  publishEligibility(@Body() dto: SemesterParam) {
    return this.eligibility.publish(dto.semesterId);
  }

  @Post('eligibility/:id/override') @HttpCode(200) @RequirePermission(PERMISSIONS.EXAMS_MANAGE)
  override(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OverrideDto) {
    return this.eligibility.override(user, id, dto.status, dto.reason);
  }

  @Delete('eligibility/:id/override') @RequirePermission(PERMISSIONS.EXAMS_MANAGE)
  clearOverride(@Param('id', ParseUUIDPipe) id: string) {
    return this.eligibility.clearOverride(id);
  }
}

@Controller('exams/clearance')
@RequirePermission(PERMISSIONS.FINANCE_CLEARANCE_MANAGE)
export class ClearanceController {
  constructor(private readonly clearance: ClearanceService) {}

  @Get()
  list(@Query() q: ClearanceListDto) {
    return this.clearance.list(q);
  }

  @Put()
  bulk(@CurrentUser() user: AuthUser, @Body() dto: BulkClearanceDto) {
    return this.clearance.bulkSet(user, dto);
  }
}

@Controller('exams/holds')
@RequirePermission(PERMISSIONS.EXAM_HOLDS_MANAGE)
export class HoldsController {
  constructor(private readonly holds: HoldsService) {}

  @Get()
  list(@Query() q: SemesterParam) {
    return this.holds.list(q.semesterId);
  }

  @Get('student/:indexNumber')
  studentCourses(@Param('indexNumber') indexNumber: string, @Query() q: SemesterParam) {
    return this.holds.studentCourses(indexNumber, q.semesterId);
  }

  @Post()
  place(@CurrentUser() user: AuthUser, @Body() dto: HoldDto) {
    return this.holds.place(user, dto);
  }

  @Post(':id/lift') @HttpCode(200)
  lift(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LiftHoldDto) {
    return this.holds.lift(user, id, dto.reason);
  }
}

@Controller('me/exams')
export class MyExamsController {
  constructor(private readonly exams: StudentExamsService) {}

  @Get()
  mine(@CurrentUser() user: AuthUser, @Query() q: SemesterParam) {
    return this.exams.mine(user, q.semesterId);
  }
}
