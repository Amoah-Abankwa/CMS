import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PERMISSIONS } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ExamRegisterService } from './exam-register.service';

class MarkDto {
  @IsOptional() @IsUUID() studentId?: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value)) @IsOptional() @IsString() @MaxLength(20) indexNumber?: string;
  @IsIn(['PRESENT', 'LATE', 'ABSENT']) status: 'PRESENT' | 'LATE' | 'ABSENT';
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsOptional() @IsString() @MaxLength(300) note?: string;
}
class MarkerDto {
  @IsBoolean() on: boolean;
}
class CloseDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

@Controller('exams')
export class ExamRegisterController {
  constructor(private readonly register: ExamRegisterService) {}

  @Post('timetables/:id/seats') @HttpCode(200) @RequirePermission(PERMISSIONS.EXAMS_MANAGE)
  seats(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.register.allocateSeats(u, id); }

  @Post('timetables/:id/notify-invigilators') @HttpCode(200) @RequirePermission(PERMISSIONS.EXAMS_MANAGE)
  notify(@Param('id', ParseUUIDPipe) id: string) { return this.register.notifyInvigilators(id); }

  @Get('dues-marker') duesMarker(@CurrentUser() u: AuthUser) { return this.register.duesMarker(u); }
  @Post('dues-marker/:departmentId') @HttpCode(200) setDuesMarker(@CurrentUser() u: AuthUser, @Param('departmentId', ParseUUIDPipe) id: string, @Body() dto: MarkerDto) { return this.register.setDuesMarker(u, id, dto.on); }

  /** Invigilators (their papers) and the Exams Office (all papers); checked in the service. */
  @Get('register') mine(@CurrentUser() u: AuthUser) { return this.register.mySessions(u); }
  @Get('register/:sessionId') sheet(@CurrentUser() u: AuthUser, @Param('sessionId', ParseUUIDPipe) id: string) { return this.register.register(u, id); }
  @Post('register/:sessionId/mark') @HttpCode(200) mark(@CurrentUser() u: AuthUser, @Param('sessionId', ParseUUIDPipe) id: string, @Body() dto: MarkDto) { return this.register.mark(u, id, dto); }
  @Post('register/:sessionId/close') @HttpCode(200) close(@CurrentUser() u: AuthUser, @Param('sessionId', ParseUUIDPipe) id: string, @Body() dto: CloseDto) { return this.register.close(u, id, dto.note); }
}
