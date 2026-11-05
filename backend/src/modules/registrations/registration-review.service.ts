import { levelOfStage, termName } from '@anu/shared';
import { AdvisorsService } from './advisors.service';
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';import { PrismaService } from '../../core/prisma/prisma.service';
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
    private readonly advisors: AdvisorsService,
    private readonly semesters: SemestersService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

    /** The registrations a reviewer can see: their departments, and their own advisees if they have any. */
  private async listWhere(user: AuthUser, q: ListRegistrationsDto, semesterId: string): Promise<Prisma.CourseRegistrationWhereInput> {
    // Built as its own typed object so the optional parts below combine cleanly.
    const student: Prisma.UserWhereInput = {
      studentProfile: { programme: { departmentId: await this.scope.departmentFilter(user) } },
      // An advisor with assigned advisees reviews only them.
      ...(await this.advisors.adviseeFilter(user).then((ids) => (ids ? { id: { in: ids } } : {}))),
      ...(q.search
        ? {
            OR: [
              { indexNumber: { contains: q.search, mode: 'insensitive' as const } },
              { firstName: { contains: q.search, mode: 'insensitive' as const } },
              { lastName: { contains: q.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    return {
      semesterId,
      // Drafts are the student's private work in progress.
      status: q.status ?? { not: 'DRAFT' },
      student,
    };
  }

  async list(user: AuthUser, q: ListRegistrationsDto) {
    const semester = await this.semesters.resolve(q.semesterId);
    const where = await this.listWhere(user, q, semester.id);
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

  /**
   * Reopens an approved registration so the student can change it and submit again, until results for
   * any of its courses have been submitted.
   */
  async reopen(user: AuthUser, id: string, reason: string) {
    const reg = await this.prisma.courseRegistration.findUnique({ where: { id }, select: { id: true, status: true, studentId: true, student: { select: { indexNumber: true, studentProfile: { select: { programme: { select: { departmentId: true } } } } } }, items: { select: { offeringId: true } } } });
    if (!reg) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Registration not found.' });
    if (reg.status !== 'APPROVED') throw new ConflictException({ code: 'NOT_APPROVED', message: 'Only an approved registration can be reopened.' });
    await this.scope.assertDepartment(user, reg.student.studentProfile?.programme.departmentId ?? '');
    const advisees = await this.advisors.adviseeFilter(user);
    if (advisees && !advisees.includes(reg.studentId)) throw new ForbiddenException({ code: 'NOT_ADVISEE', message: 'This student has another advisor.' });
    const results = await this.prisma.resultSheet.count({ where: { offeringId: { in: reg.items.map((i) => i.offeringId) }, status: { not: 'DRAFT' } } });
    if (results) throw new ConflictException({ code: 'RESULTS_IN', message: 'Results have been submitted for one of these courses, so the registration can no longer change.' });
    await this.prisma.courseRegistration.update({ where: { id }, data: { status: 'DRAFT', reopenedAt: new Date(), reopenedById: user.id, reopenReason: reason } });
    await this.audit.record({ action: 'registration.reopened', module: 'registration', targetType: 'CourseRegistration', targetId: id, metadata: { student: reg.student.indexNumber, reason } });
    return { status: 'DRAFT' };
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
    // An approved registration moves the student up to their main semester's level (never down).
    if (status === 'APPROVED') {
      const reg = await this.prisma.courseRegistration.findUnique({ where: { id }, select: { mainStage: true, student: { select: { studentProfile: { select: { id: true, currentLevel: true, programme: { select: { level: { select: { mode: true } } } } } } } } } });
      const sp = reg?.student.studentProfile;
      if (reg?.mainStage && sp) {
        const level = levelOfStage(reg.mainStage, sp.programme.level.mode === 'WEEKEND');
        if (level > sp.currentLevel) await this.prisma.studentProfile.update({ where: { id: sp.id }, data: { currentLevel: level } });
      }
    }
    await this.audit.record({
      action: status === 'APPROVED' ? 'registration.approved' : 'registration.rejected',
      module: 'registration',
      targetType: 'CourseRegistration',
      targetId: id,
      metadata: { student: row.student.indexNumber, credits: result.credits, note },
    });
    const semesterLabel = `${semester.academicYear.label} ${termName(semester.number)}`;
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
        id: true, status: true, studentId: true,
        student: { select: { studentProfile: { select: { programme: { select: { departmentId: true } } } } } },
        items: { select: { offeringId: true, offering: { select: { capacity: true, course: { select: { code: true } } } } } },
      },
    });
    if (!reg) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Registration not found.' });
    const dept = reg.student.studentProfile?.programme.departmentId;
    if (!dept) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Registration not found.' });
    await this.scope.assertDepartment(user, dept);
    const advisees = await this.advisors.adviseeFilter(user);
    if (advisees && !advisees.includes(reg.studentId)) throw new ForbiddenException({ code: 'NOT_ADVISEE', message: 'This student has another advisor.' });
    if (reg.status !== 'SUBMITTED') {
      throw new ConflictException({ code: 'NOT_SUBMITTED', message: 'Only submitted registrations can be approved or returned. The student may have withdrawn it.' });
    }
    return reg;
  }

  /** Every registration the reviewer can see, for a CSV file: one row per student. */
  async exportRows(user: AuthUser, q: ListRegistrationsDto) {
    const semester = await this.semesters.resolve(q.semesterId);
    const rows = await this.prisma.courseRegistration.findMany({
      where: await this.listWhere(user, q, semester.id),
      orderBy: { student: { indexNumber: 'asc' } },
      take: 10_000,
      select: { ...LIST_SELECT, mainStage: true, student: { select: { indexNumber: true, firstName: true, middleName: true, lastName: true, email: true, studentProfile: { select: { currentLevel: true, programme: { select: { code: true, name: true } } } } } } },
    });
    return {
      semester: `${semester.academicYear.label} ${termName(semester.number)}`,
      rows: rows.map((r) => {
        const courses = r.items.map((i) => i.offering.course).sort((a, b) => a.code.localeCompare(b.code));
        return {
          indexNumber: r.student.indexNumber, name: [r.student.firstName, r.student.middleName, r.student.lastName].filter(Boolean).join(' '), email: r.student.email,
          programme: r.student.studentProfile?.programme.name ?? '', level: r.student.studentProfile?.currentLevel ?? null, mainSemester: r.mainStage,
          status: r.status, submittedAt: r.submittedAt, reviewedAt: r.reviewedAt,
          courses: courses.map((c) => c.code).join('; '), credits: courses.reduce((t, c) => t + c.creditHours, 0),
        };
      }),
    };
  }

  // ----- A course outside the programme, approved for one student -----

  async approvals(user: AuthUser, semesterId?: string) {
    const semester = await this.semesters.resolve(semesterId);
    const advisees = await this.advisors.adviseeFilter(user);
    return this.prisma.courseApproval.findMany({
      where: { semesterId: semester.id, student: { studentProfile: { programme: { departmentId: await this.scope.departmentFilter(user) } }, ...(advisees ? { id: { in: advisees } } : {}) } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, reason: true, createdAt: true, student: { select: { firstName: true, lastName: true, indexNumber: true } }, course: { select: { code: true, title: true, creditHours: true } } },
    });
  }

  async grantApproval(user: AuthUser, dto: { indexNumber: string; courseCode: string; reason: string; semesterId?: string }) {
    const semester = await this.semesters.resolve(dto.semesterId);
    const student = await this.prisma.user.findFirst({ where: { indexNumber: dto.indexNumber.trim().toUpperCase(), type: 'STUDENT' }, select: { id: true, studentProfile: { select: { programmeId: true, programme: { select: { departmentId: true } } } } } });
    if (!student?.studentProfile) throw new NotFoundException({ code: 'NOT_FOUND', message: 'No student has that index number.' });
    await this.scope.assertDepartment(user, student.studentProfile.programme.departmentId);
    const advisees = await this.advisors.adviseeFilter(user);
    if (advisees && !advisees.includes(student.id)) throw new ForbiddenException({ code: 'NOT_ADVISEE', message: 'This student has another advisor.' });
    const code = dto.courseCode.trim().toUpperCase().replace(/^([A-Z]+)\s*(\d)/, '$1 $2');
    const course = await this.prisma.course.findUnique({ where: { code }, select: { id: true, code: true, isActive: true } });
    if (!course?.isActive) throw new NotFoundException({ code: 'NOT_FOUND', message: `There is no active course ${code}.` });
    if (await this.prisma.programmeCourse.count({ where: { programmeId: student.studentProfile.programmeId, courseId: course.id } })) {
      throw new ConflictException({ code: 'IN_PROGRAMME', message: `${code} is already in the student's programme.` });
    }
    const a = await this.prisma.courseApproval.upsert({
      where: { studentId_courseId_semesterId: { studentId: student.id, courseId: course.id, semesterId: semester.id } },
      create: { studentId: student.id, courseId: course.id, semesterId: semester.id, reason: dto.reason, approvedById: user.id },
      update: { reason: dto.reason, approvedById: user.id },
    });
    await this.audit.record({ action: 'registration.course_approved', module: 'registration', targetType: 'User', targetId: student.id, metadata: { course: code, reason: dto.reason } });
    return a;
  }

  async revokeApproval(user: AuthUser, id: string) {
    const a = await this.prisma.courseApproval.findUnique({ where: { id }, select: { studentId: true, course: { select: { code: true } }, student: { select: { studentProfile: { select: { programme: { select: { departmentId: true } } } } } } } });
    if (!a) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Approval not found.' });
    await this.scope.assertDepartment(user, a.student.studentProfile?.programme.departmentId ?? '');
    await this.prisma.courseApproval.delete({ where: { id } });
    await this.audit.record({ action: 'registration.course_approval_removed', module: 'registration', targetType: 'User', targetId: a.studentId, metadata: { course: a.course.code } });
    return { ok: true };
  }
}
