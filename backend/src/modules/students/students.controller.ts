import { RequireRecentMfa } from '../../common/decorators/require-recent-mfa.decorator';
import { AccountStatusDto } from '../staff/dto/staff.dto';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@anu/shared';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { StudentsService } from './students.service';
import { ListStudentsDto, RegisterStudentDto } from './dto/student.dto';

@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Post()
  @RequirePermission(PERMISSIONS.STUDENTS_REGISTER)
  register(@Body() dto: RegisterStudentDto) {
    return this.students.register(dto);
  }

  @Post(':id/resend-setup')
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.STUDENTS_REGISTER)
  async resendSetup(@Param('id', ParseUUIDPipe) id: string) {
    await this.students.resendSetup(id);
    return { ok: true };
  }

  @Get()
  @RequirePermission(PERMISSIONS.STUDENTS_READ)
  list(@Query() q: ListStudentsDto) {
    return this.students.list(q);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.STUDENTS_READ)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.students.get(id);
  }

  @Post(':id/status')
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.STUDENTS_REGISTER)
  @RequireRecentMfa()
  setStatus(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AccountStatusDto) {
    return this.students.setStatus(actor, id, dto.status, dto.reason);
  }
}
