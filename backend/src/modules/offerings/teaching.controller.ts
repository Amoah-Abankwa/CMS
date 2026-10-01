import { Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { IsOptional, IsUUID } from 'class-validator';
import { PERMISSIONS, termName } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { SemestersService } from '../academics/semesters.service';
import { AuditService } from '../audit/audit.service';
import { OFFERING_SELECT, OfferingsService, presentOffering } from './offerings.service';

class ClassesQuery {
  @IsOptional() @IsUUID() semesterId?: string;
}

/** A lecturer's own classes. Only offerings they are assigned to are visible. */
@Controller('teaching')
@RequirePermission(PERMISSIONS.TEACHING_READ)
export class TeachingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly semesters: SemestersService,
    private readonly offerings: OfferingsService,
    private readonly audit: AuditService,
  ) {}

  @Get('classes')
  async classes(@CurrentUser() user: AuthUser, @Query() q: ClassesQuery) {
    const semester = await this.semesters.resolve(q.semesterId);
    const rows = await this.prisma.courseOffering.findMany({
      where: { semesterId: semester.id, lecturers: { some: { userId: user.id } } },
      orderBy: { course: { code: 'asc' } },
      select: OFFERING_SELECT,
    });
    return { semester, items: rows.map(presentOffering) };
  }

  @Get('classes/:id/roster')
  async roster(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const offering = await this.prisma.courseOffering.findFirst({
      where: { id, lecturers: { some: { userId: user.id } } },
      select: { ...OFFERING_SELECT, semester: { select: { number: true, academicYear: { select: { label: true } } } } },
    });
    if (!offering) throw new ForbiddenException({ code: 'NOT_YOUR_CLASS', message: 'You are not assigned to teach this course.' });
    const students = await this.offerings.roster(id);
    await this.audit.record({ action: 'teaching.roster_viewed', module: 'teaching', targetType: 'CourseOffering', targetId: id });
    const { semester, ...rest } = offering;
    return {
      offering: presentOffering(rest),
      semesterLabel: `${semester.academicYear.label} ${termName(semester.number)}`,
      students,
    };
  }
}
