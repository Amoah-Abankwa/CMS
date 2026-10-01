import { Injectable, NotFoundException } from '@nestjs/common';
import { belowMinimum, termName } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { ScopeService } from '../rbac/scope.service';
import { SemestersService } from '../academics/semesters.service';
import { OfferingsService } from '../offerings/offerings.service';
import { AttendancePolicyService } from './attendance-policy.service';
import { AttendanceSummaryService } from './attendance-summary.service';

/** Attendance by course for Heads of Department, Deans, the Registry and QA, limited to their scope. */
@Injectable()
export class AttendanceReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly semesters: SemestersService,
    private readonly offerings: OfferingsService,
    private readonly policy: AttendancePolicyService,
    private readonly summary: AttendanceSummaryService,
  ) {}

  async byCourse(user: AuthUser, semesterId?: string) {
    const semester = await this.semesters.resolve(semesterId);
    const [policy, offerings] = await Promise.all([
      this.policy.get(),
      this.prisma.courseOffering.findMany({
        where: { semesterId: semester.id, course: { departmentId: await this.scope.departmentFilter(user) } },
        orderBy: { course: { code: 'asc' } },
        select: {
          id: true,
          course: { select: { code: true, title: true, department: { select: { name: true } } } },
          lecturers: { where: { isLead: true }, select: { user: { select: { firstName: true, lastName: true } } } },
          classSessions: { where: { cancelledAt: null }, select: { attendanceTakenAt: true, startsAt: true } },
          _count: { select: { items: { where: { registration: { status: 'APPROVED' } } } } },
        },
      }),
    ]);
    const summaries = await this.summary.summaries({ semesterId: semester.id });
    const now = new Date();
    return {
      semester,
      policy,
      items: offerings.map((o) => {
        const pcts = [...summaries].filter(([k]) => k.endsWith(`:${o.id}`)).map(([, s]) => s.percent).filter((p): p is number => p !== null);
        const past = o.classSessions.filter((s) => s.startsAt <= now);
        return {
          offeringId: o.id,
          course: o.course,
          lecturer: o.lecturers[0] ? `${o.lecturers[0].user.firstName} ${o.lecturers[0].user.lastName}` : null,
          students: o._count.items,
          classesHeld: past.filter((s) => s.attendanceTakenAt).length,
          classesWithoutRegister: past.filter((s) => !s.attendanceTakenAt).length,
          averagePercent: pcts.length ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10 : null,
          belowMinimum: pcts.filter((p) => belowMinimum(p, policy.minimumPercent)).length,
        };
      }),
    };
  }

  async course(user: AuthUser, offeringId: string) {
    const offering = await this.prisma.courseOffering.findUnique({
      where: { id: offeringId },
      select: { id: true, course: { select: { code: true, title: true, departmentId: true } }, semester: { select: { number: true, academicYear: { select: { label: true } } } } },
    });
    if (!offering) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Course not found.' });
    await this.scope.assertDepartment(user, offering.course.departmentId);
    const [roster, summaries, policy] = await Promise.all([this.offerings.roster(offeringId), this.summary.summaries({ offeringIds: [offeringId] }), this.policy.get()]);
    return {
      offering: { id: offering.id, course: offering.course, semesterLabel: `${offering.semester.academicYear.label} ${termName(offering.semester.number)}` },
      policy,
      students: roster.map((s) => {
        const sum = summaries.get(AttendanceSummaryService.key(s.id, offeringId)) ?? null;
        return { ...s, summary: sum, belowMinimum: !!sum && belowMinimum(sum.percent, policy.minimumPercent) };
      }),
    };
  }
}
