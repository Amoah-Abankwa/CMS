import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PERMISSIONS } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CourseDropsService } from './course-drops.service';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
class DropDto { @IsUUID() offeringId: string; @Transform(trim) @IsString() @MinLength(5) @MaxLength(500) reason: string; }
class DecideDto { @IsBoolean() approve: boolean; @Transform(trim) @IsOptional() @IsString() @MaxLength(500) note?: string; }
class SemesterQ { @IsOptional() @IsUUID() semesterId?: string; }
class MalpracticeDto {
  @Transform(trim) @IsString() @MinLength(6) @MaxLength(20) indexNumber: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(12) courseCode?: string;
  @IsDateString() occurredOn: string;
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(2000) offence: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(1000) sanction?: string;
  @IsOptional() @IsUUID() semesterId?: string;
}

/** A student's own drop requests. */
@Controller('me/drops')
export class MyDropsController {
  constructor(private readonly drops: CourseDropsService) {}
  @Get() mine(@CurrentUser() u: AuthUser) { return this.drops.mine(u); }
  @Post() request(@CurrentUser() u: AuthUser, @Body() dto: DropDto) { return this.drops.request(u, dto.offeringId, dto.reason); }
  @Post(':id/withdraw') @HttpCode(200) withdraw(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.drops.withdraw(u, id); }
}

@Controller('course-drops')
@RequirePermission(PERMISSIONS.COURSE_DROPS_APPROVE)
export class CourseDropsController {
  constructor(private readonly drops: CourseDropsService) {}
  @Get() pending(@CurrentUser() u: AuthUser, @Query() q: SemesterQ) { return this.drops.pending(u, q.semesterId); }
  @Post(':id/decide') @HttpCode(200) decide(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideDto) { return this.drops.decide(u, id, dto.approve, dto.note); }
}

@Controller('registration-records')
@RequirePermission(PERMISSIONS.REGISTRATION_RECORDS_READ)
export class RegistrationRecordsController {
  constructor(private readonly drops: CourseDropsService) {}
  @Get('dropped') dropped(@CurrentUser() u: AuthUser, @Query() q: SemesterQ) { return this.drops.dropped(u, q.semesterId); }
  @Get('rejected-registrations') rejected(@CurrentUser() u: AuthUser, @Query() q: SemesterQ) { return this.drops.rejectedRegistrations(u, q.semesterId); }
  @Get('rejected-drops') rejectedDrops(@CurrentUser() u: AuthUser, @Query() q: SemesterQ) { return this.drops.rejectedDrops(u, q.semesterId); }
  @Get('malpractice') malpractice(@CurrentUser() u: AuthUser, @Query() q: SemesterQ) { return this.drops.malpractice(u, q.semesterId); }
}

/** The Exams Office records malpractice cases. */
@Controller('malpractice')
@RequirePermission(PERMISSIONS.EXAMS_MANAGE)
export class MalpracticeController {
  constructor(private readonly drops: CourseDropsService) {}
  @Get() list(@CurrentUser() u: AuthUser, @Query() q: SemesterQ) { return this.drops.malpractice(u, q.semesterId); }
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: MalpracticeDto) { return this.drops.recordMalpractice(u, dto); }
  @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MalpracticeDto) { return this.drops.recordMalpractice(u, dto, id); }
  @Delete(':id') remove(@Param('id', ParseUUIDPipe) id: string) { return this.drops.deleteMalpractice(id); }
}
