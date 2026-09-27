import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { ScopeService } from '../rbac/scope.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { SemestersService } from '../academics/semesters.service';
import { ListRegistrationsDto } from './dto/registration.dto';

const LIST_SELECT = {
  id: true, status: true, submittedAt: true, reviewedAt: true, reviewNote: true,
  student: {
    select: {
      id: true, indexNumber: true, firstName: true, middleName: true, lastName: true,
      studentProfile: { select: { currentLevel: true, programme: { select: { code: true, name: true } } } },
    },
  },
  items: { select: { offering: { select: { course: { select: { code: true, title: true, creditHours: true } } } } } },
  reviewedBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.CourseRegistrationSelect;

type Row = Prisma.CourseRegistrationGetPayload<{ select: typeof LIST_SELECT }>;

function present(r: Row) {
  const courses = r.items.map((i) => i.offering.course).sort((a, b) => a.code.localeCompare(b.code));
  return {
    id: r.id,
    status: r.status,
    submittedAt: r.submittedAt,
    reviewedAt: r.reviewedAt,
    reviewNote: r.reviewNote,
    reviewedBy: r.reviewedBy ? `${r.reviewedBy.firstName} ${r.reviewedBy.lastName}` : null,
    student: r.student,
    courses,
    credits: courses.reduce((s, c) => s + c.creditHours, 0),
  };
}

/** Reviewers only see students whose programme belongs to a department in their scope. */
@Injectable()
export class RegistrationReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly semesters: SemestersService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, q: ListRegistrationsDto) {
    const semester = await this.semesters.resolve(q.semesterId);
    const where: Prisma.CourseRegistrationWhereInput = {
      semesterId: semester.id,
      // Drafts are the student's private work in progress.
      status: q.status ?? { not: 'DRAFT' },
      student: {
        studentProfile: { programme: { departmentId: await this.scope.departmentFilter(user) } },
        ...(q.search
          ? {
              OR: [
                { indexNumber: { contains: q.search, mode: 'insensitive' as const } },
                { firstName: { contains: q.search, mode: 'insensitive' as const } },
                { lastName: { contains: q.search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
    };
    const [rows, total, counts] = await this.prisma.$transaction([
      this.prisma.courseRegistration.findMany({
        where,
        orderBy: [{ submittedAt: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: LIST_SELECT,
      }),
      this.prisma.courseRegistration.count({ where }),
      this.prisma.courseRegistration.groupBy({
        by: ['status'],
        where: { semesterId: semester.id, student: where.student },
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
    ]);
    return {
      semester,
      items: rows.map(present),
      total,
      page: q.page,
      pageSize: q.pageSize,
      counts: Object.fromEntries(counts.map((c) => [c.status, (c._count as { _all: number })._all])),
    };
  }

  async approve(user: AuthUser, id: string, note?: string) {
    const reg = await this.loadSubmitted(user, id);
    // Final seat check: approved students never exceed a course's limit.
    for (const item of reg.items) {
      const cap = item.offering.capacity;
      if (cap === null) continue;
      const approved = await this.prisma.courseRegistrationItem.count({ where: { offeringId: item.offeringId, registration: { status: 'APPROVED' } } });
      if (approved >= cap) {
        throw new ConflictException({ code: 'COURSE_FULL', message: `${item.offering.course.code} is full. Return the registration so the student can choose another course, or raise the limit.` });
      }
    }
    return this.decide(user, reg.id, 'APPROVED', note);
  }

  async reject(user: AuthUser, id: string, note: string) {
    const reg = await this.loadSubmitted(user, id);
    return this.decide(user, reg.id, 'REJECTED', note);
  }

  private async decide(user: AuthUser, id: string, status: 'APPROVED' | 'REJECTED', note?: string) {
    const updated = await this.prisma.courseRegistration.update({
      where: { id },
      data: { status, reviewedAt: new Date(), reviewedById: user.id, reviewNote: note?.trim() || null },
      select: { ...LIST_SELECT, semester: { select: { number: true, registrationClosesAt: true, academicYear: { select: { label: true } } } } },
    });
    const { semester, ...row } = updated;
    const result = present(row);
    await this.audit.record({
      action: status === 'APPROVED' ? 'registration.approved' : 'registration.rejected',
      module: 'registration',
      targetType: 'CourseRegistration',
      targetId: id,
      metadata: { student: row.student.indexNumber, credits: result.credits, note },
    });
    const semesterLabel = `${semester.academicYear.label}, Semester ${semester.number}`;
    await this.notifications.notify({
      eventKey: status === 'APPROVED' ? EVENT_KEYS.REGISTRATION_APPROVED : EVENT_KEYS.REGISTRATION_REJECTED,
      recipients: [{ userId: row.student.id }],
      channels: ['IN_APP', 'EMAIL', 'SMS'],
      sharedVars: {
        semesterLabel,
        courseCount: result.courses.length,
        credits: result.credits,
        note: note ?? '',
        noteLine: note ? `Note from your department: ${note}` : '',
        closesAt: semester.registrationClosesAt
          ? semester.registrationClosesAt.toLocaleString('en-GB', { timeZone: 'Africa/Accra', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
          : 'the deadline',
      },
      link: '/registration',
    });
    return result;
  }

  private async loadSubmitted(user: AuthUser, id: string) {
    const reg = await this.prisma.courseRegistration.findUnique({
      where: { id },
      select: {
        id: true, status: true,
        student: { select: { studentProfile: { select: { programme: { select: { departmentId: true } } } } } },
        items: { select: { offeringId: true, offering: { select: { capacity: true, course: { select: { code: true } } } } } },
      },
    });
    if (!reg) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Registration not found.' });
    const dept = reg.student.studentProfile?.programme.departmentId;
    if (!dept) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Registration not found.' });
    await this.scope.assertDepartment(user, dept);
    if (reg.status !== 'SUBMITTED') {
      throw new ConflictException({ code: 'NOT_SUBMITTED', message: 'Only submitted registrations can be approved or returned. The student may have withdrawn it.' });
    }
    return reg;
  }
}
