import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { amendedResult, PERMISSIONS } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { PermissionResolverService } from '../rbac/permission-resolver.service';
import { ScopeService } from '../rbac/scope.service';

const STAGES = {
  REQUESTED: { permission: PERMISSIONS.RESULTS_APPROVE_DEPARTMENT, next: 'HOD_APPROVED', label: 'Head of Department' },
  HOD_APPROVED: { permission: PERMISSIONS.RESULTS_APPROVE_SCHOOL, next: 'DEAN_APPROVED', label: 'Dean' },
  DEAN_APPROVED: { permission: PERMISSIONS.RESULTS_PUBLISH, next: 'APPLIED', label: 'Exams Office or Registrar' },
} as const;

const SELECT = {
  id: true, reason: true, before: true, newCaScore: true, newExamScore: true, after: true, status: true, requestedAt: true, rejectNote: true,
  hodApprovedAt: true, deanApprovedAt: true, appliedAt: true, rejectedAt: true,
  result: {
    select: {
      id: true, studentId: true, devotionScore: true, devotionExempt: true,
      student: { select: { firstName: true, lastName: true, indexNumber: true } },
      sheet: { select: { id: true, status: true, scaleId: true, offering: { select: { id: true, course: { select: { code: true, title: true, departmentId: true } }, semester: { select: { number: true, academicYear: { select: { label: true } } } } } } } },
    },
  },
} satisfies Prisma.ResultAmendmentSelect;

type Snapshot = { caScore: number; examScore: number; total: number; grade: string; gradePoint: number; isPass: boolean; incomplete: boolean };
const show = (r: Snapshot) => `${r.grade} (${r.total})`;

/**
 * Corrections to published results. Requested by the course's lead lecturer or the Exams Office with a
 * reason and the corrected scores; approved by the Head of Department and the Dean; applied by the Exams
 * Office or Registrar. The original stays on record; the student is told the before and after.
 */
@Injectable()
export class AmendmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: PermissionResolverService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Published results this person may request an amendment for: courses they lead, or any for the Exams Office. */
  async amendable(user: AuthUser, q: { indexNumber?: string; courseCode?: string }) {
    const perms = await this.resolver.permissionsFor(user.id, user.activeRoleKey);
    const all = perms.has(PERMISSIONS.RESULTS_PUBLISH);
    if (!q.indexNumber && !q.courseCode) return [];
    return this.prisma.courseResult.findMany({
      where: {
        sheet: { status: 'PUBLISHED', offering: { ...(all ? {} : { lecturers: { some: { userId: user.id, isLead: true } } }), ...(q.courseCode ? { course: { code: { contains: q.courseCode.trim(), mode: 'insensitive' } } } : {}) } },
        ...(q.indexNumber ? { student: { indexNumber: { contains: q.indexNumber.trim().toUpperCase() } } } : {}),
      },
      take: 50,
      orderBy: { student: { indexNumber: 'asc' } },
      select: {
        id: true, caScore: true, examScore: true, total: true, grade: true, incomplete: true,
        student: { select: { firstName: true, lastName: true, indexNumber: true } },
        sheet: { select: { offering: { select: { course: { select: { code: true, title: true } }, semester: { select: { number: true, academicYear: { select: { label: true } } } } } } } },
        amendments: { where: { status: { in: ['REQUESTED', 'HOD_APPROVED', 'DEAN_APPROVED'] } }, select: { id: true } },
      },
    });
  }

  async request(user: AuthUser, resultId: string, dto: { caScore: number; examScore: number; reason: string }) {
    const r = await this.prisma.courseResult.findUnique({ where: { id: resultId }, include: { sheet: { include: { offering: { include: { lecturers: { where: { userId: user.id }, select: { isLead: true } }, course: { select: { departmentId: true } } } } } } } });
    if (!r) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Result not found.' });
    if (r.sheet.status !== 'PUBLISHED') throw new ConflictException({ code: 'NOT_PUBLISHED', message: 'Only published results are amended. Change unpublished marks on the marks sheet.' });
    const perms = await this.resolver.permissionsFor(user.id, user.activeRoleKey);
    const isLead = r.sheet.offering.lecturers[0]?.isLead;
    if (!isLead && !perms.has(PERMISSIONS.RESULTS_PUBLISH)) throw new ForbiddenException({ code: 'NOT_ALLOWED', message: "Only the course's lead lecturer or the Exams Office can request an amendment." });
    if (await this.prisma.resultAmendment.count({ where: { resultId, status: { in: ['REQUESTED', 'HOD_APPROVED', 'DEAN_APPROVED'] } } })) {
      throw new ConflictException({ code: 'PENDING', message: 'An amendment for this result is already waiting for approval.' });
    }
    const before: Snapshot = { caScore: r.caScore, examScore: r.examScore, total: r.total, grade: r.grade, gradePoint: r.gradePoint, isPass: r.isPass, incomplete: r.incomplete };
    const a = await this.prisma.resultAmendment.create({ data: { resultId, reason: dto.reason, before, newCaScore: dto.caScore, newExamScore: dto.examScore, requestedById: user.id } });
    await this.audit.record({ action: 'results.amendment_requested', module: 'results', targetType: 'CourseResult', targetId: resultId, before, after: { caScore: dto.caScore, examScore: dto.examScore }, metadata: { reason: dto.reason } });
    return a;
  }

  /** Amendments this person can act on now, plus recent ones in their scope. */
  async list(user: AuthUser, status?: string) {
    const perms = await this.resolver.permissionsFor(user.id, user.activeRoleKey);
    const reviewer = [PERMISSIONS.RESULTS_APPROVE_DEPARTMENT, PERMISSIONS.RESULTS_APPROVE_SCHOOL, PERMISSIONS.RESULTS_PUBLISH, PERMISSIONS.RESULTS_READ_ALL].some((p) => perms.has(p));
    if (!reviewer) {
      // Lecturers see the amendments they requested.
      return (await this.prisma.resultAmendment.findMany({ where: { requestedById: user.id }, orderBy: { requestedAt: 'desc' }, take: 100, select: SELECT })).map((a) => ({ ...a, waitingFor: STAGES[a.status as keyof typeof STAGES]?.label ?? null, canAct: false }));
    }
    const departments = await this.scope.departmentFilter(user);
    const rows = await this.prisma.resultAmendment.findMany({
      where: { ...(status ? { status: status as never } : {}), result: { sheet: { offering: { course: { departmentId: departments } } } } },
      orderBy: { requestedAt: 'desc' },
      take: 200,
      select: SELECT,
    });
    return rows.map((a) => {
      const stage = STAGES[a.status as keyof typeof STAGES];
      return { ...a, waitingFor: stage?.label ?? null, canAct: !!stage && perms.has(stage.permission) };
    });
  }

  private async load(user: AuthUser, id: string) {
    const a = await this.prisma.resultAmendment.findUnique({ where: { id }, select: SELECT });
    if (!a) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Amendment not found.' });
    await this.scope.assertDepartment(user, a.result.sheet.offering.course.departmentId);
    return a;
  }

  async approve(user: AuthUser, id: string) {
    const a = await this.load(user, id);
    const stage = STAGES[a.status as keyof typeof STAGES];
    if (!stage) throw new ConflictException({ code: 'CLOSED', message: 'This amendment is already applied or rejected.' });
    const perms = await this.resolver.permissionsFor(user.id, user.activeRoleKey);
    if (!perms.has(stage.permission)) throw new ForbiddenException({ code: 'NOT_YOUR_STEP', message: `This amendment is waiting for the ${stage.label}.` });
    const now = new Date();
    if (stage.next !== 'APPLIED') {
      const data = stage.next === 'HOD_APPROVED' ? { hodApprovedById: user.id, hodApprovedAt: now } : { deanApprovedById: user.id, deanApprovedAt: now };
      const moved = await this.prisma.resultAmendment.updateMany({ where: { id, status: a.status }, data: { status: stage.next, ...data } });
      if (moved.count !== 1) throw new ConflictException({ code: 'CHANGED', message: 'This amendment was just updated. Refresh.' });
      await this.audit.record({ action: 'results.amendment_approved', module: 'results', targetType: 'ResultAmendment', targetId: id, after: { status: stage.next } });
      return { status: stage.next };
    }
    // Apply: regrade on the scale the sheet was graded with.
    const scale = await this.prisma.gradingScale.findUnique({ where: { id: a.result.sheet.scaleId ?? '' }, include: { bands: true } });
    if (!scale) throw new BadRequestException({ code: 'NO_SCALE', message: 'The grading scale for this sheet is missing.' });
    const devotion = a.result.devotionExempt ? { exempt: true as const } : a.result.devotionScore !== null ? { score: a.result.devotionScore } : null;
const after = amendedResult(
  a.newCaScore,
  a.newExamScore,
  scale.bands as never,
);    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.resultAmendment.updateMany({ where: { id, status: 'DEAN_APPROVED' }, data: { status: 'APPLIED', appliedById: user.id, appliedAt: now, after } });
      if (moved.count !== 1) throw new ConflictException({ code: 'CHANGED', message: 'This amendment was just updated. Refresh.' });
      await tx.courseResult.update({ where: { id: a.result.id }, data: after });
    });
    const before = a.before as Snapshot;
    const course = `${a.result.sheet.offering.course.code} ${a.result.sheet.offering.course.title}`;
    await this.audit.record({ action: 'results.amendment_applied', module: 'results', targetType: 'CourseResult', targetId: a.result.id, before, after, metadata: { reason: a.reason, student: a.result.student.indexNumber } });
    await this.notifications.notify({
      eventKey: EVENT_KEYS.RESULT_AMENDED,
      recipients: [{ userId: a.result.studentId }],
      channels: ['IN_APP', 'EMAIL', 'SMS'],
      sharedVars: { course, semester: `${a.result.sheet.offering.semester.academicYear.label}, Semester ${a.result.sheet.offering.semester.number}`, before: show(before), after: show(after), reason: a.reason },
      link: '/results',
    });
    return { status: 'APPLIED', after };
  }

  async reject(user: AuthUser, id: string, note: string) {
    const a = await this.load(user, id);
    const stage = STAGES[a.status as keyof typeof STAGES];
    if (!stage) throw new ConflictException({ code: 'CLOSED', message: 'This amendment is already applied or rejected.' });
    const perms = await this.resolver.permissionsFor(user.id, user.activeRoleKey);
    if (!perms.has(stage.permission)) throw new ForbiddenException({ code: 'NOT_YOUR_STEP', message: `This amendment is waiting for the ${stage.label}.` });
    await this.prisma.resultAmendment.update({ where: { id }, data: { status: 'REJECTED', rejectedById: user.id, rejectedAt: new Date(), rejectNote: note } });
    await this.audit.record({ action: 'results.amendment_rejected', module: 'results', targetType: 'ResultAmendment', targetId: id, after: { note } });
    return { status: 'REJECTED' };
  }
}
