import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { dropProblem, termName } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { ScopeService } from '../rbac/scope.service';
import { SemestersService } from '../academics/semesters.service';

const DROP_SELECT = {
  id: true, reason: true, status: true, decisionNote: true, decidedAt: true, createdAt: true,
  student: { select: { id: true, firstName: true, lastName: true, indexNumber: true, studentProfile: { select: { currentLevel: true, programme: { select: { name: true } } } } } },
  offering: { select: { id: true, course: { select: { code: true, title: true, creditHours: true } }, semester: { select: { number: true, academicYear: { select: { label: true } } } } } },
} as const;

/**
 * Dropping a course from an approved registration, and the registration records the Registry, Heads of
 * Department and Registration Officers look at: dropped courses, rejected registrations, rejected drop
 * requests and exam malpractice cases (recorded by the Exams Office).
 */
@Injectable()
export class CourseDropsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly semesters: SemestersService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ----- Students -----

  async mine(user: AuthUser) {
    return this.prisma.courseDropRequest.findMany({ where: { studentId: user.id }, orderBy: { createdAt: 'desc' }, take: 50, select: DROP_SELECT });
  }

  async request(user: AuthUser, offeringId: string, reason: string) {
    if (user.type !== 'STUDENT') throw new ForbiddenException({ code: 'STUDENTS_ONLY', message: 'Students ask to drop their courses.' });
    const item = await this.prisma.courseRegistrationItem.findFirst({
      where: { offeringId, registration: { studentId: user.id, status: 'APPROVED' } },
      select: { registration: { select: { id: true, semesterId: true, semester: { select: { dropDeadline: true, minCredits: true, isCurrent: true } }, items: { select: { offering: { select: { course: { select: { creditHours: true } } } } } } } }, offering: { select: { course: { select: { code: true, creditHours: true } }, resultSheet: { select: { status: true } } } } },
    });
    if (!item) throw new NotFoundException({ code: 'NOT_REGISTERED', message: 'You can only drop a course on your approved registration.' });
    if (!item.registration.semester.isCurrent) throw new BadRequestException({ code: 'NOT_CURRENT', message: 'You can only drop courses this semester.' });
    if (item.offering.resultSheet && item.offering.resultSheet.status !== 'DRAFT') throw new ConflictException({ code: 'RESULTS_IN', message: 'Results for this course have been submitted, so it cannot be dropped.' });
    const creditsNow = item.registration.items.reduce((t, i) => t + i.offering.course.creditHours, 0);
    const pending = await this.prisma.courseDropRequest.findMany({ where: { registrationId: item.registration.id, status: 'REQUESTED' }, select: { offeringId: true, offering: { select: { course: { select: { creditHours: true } } } } } });
    if (pending.some((p) => p.offeringId === offeringId)) throw new ConflictException({ code: 'PENDING', message: 'You have already asked to drop this course.' });
    // Credits already being dropped count too.
    const afterPending = creditsNow - pending.reduce((t, p) => t + p.offering.course.creditHours, 0);
    const problem = dropProblem({ deadline: item.registration.semester.dropDeadline, now: new Date(), creditsNow: afterPending, courseCredits: item.offering.course.creditHours, minCredits: item.registration.semester.minCredits });
    if (problem) throw new BadRequestException({ code: 'DROP', message: problem });
    const r = await this.prisma.courseDropRequest.create({ data: { registrationId: item.registration.id, studentId: user.id, offeringId, semesterId: item.registration.semesterId, reason } });
    await this.audit.record({ action: 'registration.drop_requested', module: 'registration', targetType: 'CourseDropRequest', targetId: r.id, metadata: { course: item.offering.course.code, reason } });
    return r;
  }

  async withdraw(user: AuthUser, id: string) {
    const r = await this.prisma.courseDropRequest.findUnique({ where: { id } });
    if (!r || r.studentId !== user.id) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Request not found.' });
    if (r.status !== 'REQUESTED') throw new ConflictException({ code: 'DECIDED', message: 'This request has already been decided.' });
    await this.prisma.courseDropRequest.update({ where: { id }, data: { status: 'WITHDRAWN' } });
    return { ok: true };
  }

  // ----- Approvers -----

  private async where(user: AuthUser, semesterId: string | undefined, status: 'REQUESTED' | 'APPROVED' | 'REJECTED') {
    const semester = await this.semesters.resolve(semesterId);
    return { semester, where: { semesterId: semester.id, status, student: { studentProfile: { programme: { departmentId: await this.scope.departmentFilter(user) } } } } };
  }

  async pending(user: AuthUser, semesterId?: string) {
    const { where } = await this.where(user, semesterId, 'REQUESTED');
    return this.prisma.courseDropRequest.findMany({ where, orderBy: { createdAt: 'asc' }, select: DROP_SELECT });
  }

  async decide(user: AuthUser, id: string, approve: boolean, note?: string) {
    const r = await this.prisma.courseDropRequest.findUnique({ where: { id }, select: { ...DROP_SELECT, registrationId: true, offeringId: true, student: { select: { ...DROP_SELECT.student.select, studentProfile: { select: { programme: { select: { departmentId: true, name: true } }, currentLevel: true } } } } } });
    if (!r) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Request not found.' });
    await this.scope.assertDepartment(user, r.student.studentProfile?.programme.departmentId ?? '');
    if (r.status !== 'REQUESTED') throw new ConflictException({ code: 'DECIDED', message: 'This request has already been decided.' });
    if (!approve && !note) throw new BadRequestException({ code: 'NOTE', message: 'Tell the student why.' });
    await this.prisma.$transaction(async (tx) => {
      if (approve) {
        const sheet = await tx.resultSheet.findUnique({ where: { offeringId: r.offeringId }, select: { status: true } });
        if (sheet && sheet.status !== 'DRAFT') throw new ConflictException({ code: 'RESULTS_IN', message: 'Results for this course have been submitted, so it cannot be dropped.' });
        await tx.courseRegistrationItem.deleteMany({ where: { registrationId: r.registrationId, offeringId: r.offeringId } });
      }
      await tx.courseDropRequest.update({ where: { id }, data: { status: approve ? 'APPROVED' : 'REJECTED', decisionNote: note || null, decidedById: user.id, decidedAt: new Date() } });
    });
    const course = `${r.offering.course.code} ${r.offering.course.title}`;
    await this.audit.record({ action: approve ? 'registration.drop_approved' : 'registration.drop_rejected', module: 'registration', targetType: 'CourseDropRequest', targetId: id, metadata: { student: r.student.indexNumber, course, note } });
    await this.notifications.notify({
      eventKey: EVENT_KEYS.TIMESHEET_UPDATE,
      recipients: [{ userId: r.student.id }],
      channels: ['IN_APP', 'EMAIL'],
      sharedVars: { headline: approve ? `${r.offering.course.code} has been dropped from your registration` : `Your request to drop ${r.offering.course.code} was not approved`, detail: note ?? '' },
      link: '/courses',
    });
    return { status: approve ? 'APPROVED' : 'REJECTED' };
  }

  // ----- Registration records -----

  async dropped(user: AuthUser, semesterId?: string) {
    const { semester, where } = await this.where(user, semesterId, 'APPROVED');
    return { semester: `${semester.academicYear.label} ${termName(semester.number)}`, rows: await this.prisma.courseDropRequest.findMany({ where, orderBy: { decidedAt: 'desc' }, select: DROP_SELECT }) };
  }

  async rejectedDrops(user: AuthUser, semesterId?: string) {
    const { semester, where } = await this.where(user, semesterId, 'REJECTED');
    return { semester: `${semester.academicYear.label} ${termName(semester.number)}`, rows: await this.prisma.courseDropRequest.findMany({ where, orderBy: { decidedAt: 'desc' }, select: DROP_SELECT }) };
  }

  async rejectedRegistrations(user: AuthUser, semesterId?: string) {
    const semester = await this.semesters.resolve(semesterId);
    const rows = await this.prisma.courseRegistration.findMany({
      where: { semesterId: semester.id, status: 'REJECTED', student: { studentProfile: { programme: { departmentId: await this.scope.departmentFilter(user) } } } },
      orderBy: { reviewedAt: 'desc' },
      select: {
        id: true, reviewNote: true, reviewedAt: true, submittedAt: true,
        reviewedBy: { select: { firstName: true, lastName: true } },
        student: { select: { firstName: true, lastName: true, indexNumber: true, studentProfile: { select: { currentLevel: true, programme: { select: { name: true } } } } } },
        items: { select: { offering: { select: { course: { select: { code: true, creditHours: true } } } } } },
      },
    });
    return { semester: `${semester.academicYear.label} ${termName(semester.number)}`, rows: rows.map(({ items, ...r }) => ({ ...r, courses: items.map((i) => i.offering.course.code).sort().join(', '), credits: items.reduce((t, i) => t + i.offering.course.creditHours, 0) })) };
  }

  // ----- Exam malpractice (recorded by the Exams Office) -----

  async malpractice(user: AuthUser, semesterId?: string) {
    const semester = await this.semesters.resolve(semesterId);
    const rows = await this.prisma.malpracticeCase.findMany({
      where: { semesterId: semester.id, student: { studentProfile: { programme: { departmentId: await this.scope.departmentFilter(user) } } } },
      orderBy: { occurredOn: 'desc' },
      select: { id: true, occurredOn: true, offence: true, sanction: true, createdAt: true, student: { select: { firstName: true, lastName: true, indexNumber: true, studentProfile: { select: { programme: { select: { name: true } } } } } }, offering: { select: { course: { select: { code: true, title: true } } } } },
    });
    return { semester: `${semester.academicYear.label} ${termName(semester.number)}`, rows };
  }

  async recordMalpractice(user: AuthUser, dto: { indexNumber: string; courseCode?: string; occurredOn: string; offence: string; sanction?: string; semesterId?: string }, id?: string) {
    const semester = await this.semesters.resolve(dto.semesterId);
    const student = await this.prisma.user.findFirst({ where: { indexNumber: dto.indexNumber.trim().toUpperCase(), type: 'STUDENT' }, select: { id: true } });
    if (!student) throw new NotFoundException({ code: 'NOT_FOUND', message: 'No student has that index number.' });
    let offeringId: string | null = null;
    if (dto.courseCode?.trim()) {
      const code = dto.courseCode.trim().toUpperCase().replace(/^([A-Z]+)\s*(\d)/, '$1 $2');
      const o = await this.prisma.courseOffering.findFirst({ where: { semesterId: semester.id, course: { code } }, select: { id: true } });
      if (!o) throw new NotFoundException({ code: 'NO_COURSE', message: `${code} was not taught in that semester.` });
      offeringId = o.id;
    }
    const data = { studentId: student.id, offeringId, semesterId: semester.id, occurredOn: new Date(`${dto.occurredOn.slice(0, 10)}T00:00:00Z`), offence: dto.offence, sanction: dto.sanction || null };
    const c = id ? await this.prisma.malpracticeCase.update({ where: { id }, data }) : await this.prisma.malpracticeCase.create({ data: { ...data, recordedById: user.id } });
    await this.audit.record({ action: id ? 'exams.malpractice_updated' : 'exams.malpractice_recorded', module: 'exams', targetType: 'MalpracticeCase', targetId: c.id, metadata: { student: dto.indexNumber, course: dto.courseCode } });
    return c;
  }

  async deleteMalpractice(id: string) {
    await this.prisma.malpracticeCase.delete({ where: { id } });
    await this.audit.record({ action: 'exams.malpractice_deleted', module: 'exams', targetType: 'MalpracticeCase', targetId: id });
    return { ok: true };
  }
}
