import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PERMISSIONS, ROLE_KEYS, scopeValue, termName } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { PermissionResolverService } from '../rbac/permission-resolver.service';
import { ScopeService } from '../rbac/scope.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { SemestersService } from '../academics/semesters.service';
import { MarksService } from './marks.service';
import { ListSheetsDto } from './dto/results.dto';

type Status = 'SUBMITTED' | 'HOD_APPROVED' | 'DEAN_APPROVED' | 'PUBLISHED';

/** Which permission acts at each stage, and where the sheet goes next. */
const STAGES: Record<Exclude<Status, 'PUBLISHED'>, { permission: string; next: Status; action: string }> = {
  SUBMITTED: { permission: PERMISSIONS.RESULTS_APPROVE_DEPARTMENT, next: 'HOD_APPROVED', action: 'results.approved_department' },
  HOD_APPROVED: { permission: PERMISSIONS.RESULTS_APPROVE_SCHOOL, next: 'DEAN_APPROVED', action: 'results.approved_school' },
  DEAN_APPROVED: { permission: PERMISSIONS.RESULTS_PUBLISH, next: 'PUBLISHED', action: 'results.published' },
};

const SHEET_SELECT = {
  id: true, status: true, submittedAt: true, hodApprovedAt: true, deanApprovedAt: true, publishedAt: true, returnNote: true, returnedAt: true,
  scale: { select: { version: true, name: true, passMark: true } },
  offering: {
    select: {
      id: true,
      semester: { select: { id: true, number: true, academicYear: { select: { label: true } } } },
      course: { select: { code: true, title: true, creditHours: true, department: { select: { id: true, name: true, schoolId: true } } } },
      lecturers: { orderBy: { isLead: 'desc' }, select: { isLead: true, user: { select: { id: true, firstName: true, lastName: true } } } },
    },
  },
  results: { select: { grade: true, total: true, isPass: true, incomplete: true } },
} satisfies Prisma.ResultSheetSelect;

type SheetRow = Prisma.ResultSheetGetPayload<{ select: typeof SHEET_SELECT }>;

function summarise(results: SheetRow['results']) {
  const counted = results.filter((r) => !r.incomplete);
  const distribution: Record<string, number> = {};
  for (const r of results) distribution[r.grade] = (distribution[r.grade] ?? 0) + 1;
  return {
    students: results.length,
    passRate: counted.length ? Math.round((counted.filter((r) => r.isPass).length / counted.length) * 1000) / 10 : null,
    mean: counted.length ? Math.round((counted.reduce((s, r) => s + r.total, 0) / counted.length) * 10) / 10 : null,
    incomplete: results.length - counted.length,
    distribution,
  };
}

@Injectable()
export class ResultApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: PermissionResolverService,
    private readonly scope: ScopeService,
    private readonly semesters: SemestersService,
    private readonly marks: MarksService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, q: ListSheetsDto) {
    const perms = await this.permissions(user);
    const semester = await this.semesters.resolve(q.semesterId);
    const actionable = (Object.keys(STAGES) as Array<keyof typeof STAGES>).filter((s) => perms.has(STAGES[s].permission));
    const status =
      q.status === 'ACTION' ? { in: actionable } : q.status ? (q.status as Status) : { not: 'DRAFT' as const };
    const rows = await this.prisma.resultSheet.findMany({
      where: { status, offering: { semesterId: semester.id, course: { departmentId: await this.scope.departmentFilter(user) } } },
      orderBy: [{ submittedAt: 'asc' }],
      select: SHEET_SELECT,
    });
    return { semester, items: rows.map((r) => this.present(r, perms)), actionableStages: actionable };
  }

  async get(user: AuthUser, id: string) {
    const perms = await this.permissions(user);
    const sheet = await this.load(user, id);
    const results = await this.prisma.courseResult.findMany({
      where: { sheetId: id },
      orderBy: { student: { indexNumber: 'asc' } },
      select: {
        caScore: true, examScore: true, total: true, grade: true, gradePoint: true, isPass: true, incomplete: true,
        student: { select: { id: true, indexNumber: true, firstName: true, middleName: true, lastName: true } },
      },
    });
    return { ...this.present(sheet, perms), results };
  }

  /** Moves the sheet to the next stage. The same call approves (HOD, Dean) or publishes (Exam Coordinator, Registry). */
  async advance(user: AuthUser, id: string) {
    const perms = await this.permissions(user);
    const sheet = await this.load(user, id);
    const stage = STAGES[sheet.status as keyof typeof STAGES];
    if (!stage) throw new ConflictException({ code: 'NOT_PENDING', message: 'These results are not waiting for approval.' });
    if (!perms.has(stage.permission)) throw new ForbiddenException({ code: 'NOT_YOUR_STAGE', message: 'These results are waiting for someone else.' });

    const now = new Date();
    const data: Prisma.ResultSheetUpdateInput =
      stage.next === 'HOD_APPROVED' ? { status: 'HOD_APPROVED', hodApprovedAt: now, hodApprovedById: user.id }
      : stage.next === 'DEAN_APPROVED' ? { status: 'DEAN_APPROVED', deanApprovedAt: now, deanApprovedById: user.id }
      : { status: 'PUBLISHED', publishedAt: now, publishedById: user.id };

    // The status condition stops two approvers acting on the same stage at once.
    const updated = await this.prisma.resultSheet.updateMany({ where: { id, status: sheet.status }, data: data as Prisma.ResultSheetUpdateManyMutationInput });
    if (updated.count !== 1) throw new ConflictException({ code: 'CHANGED', message: 'Someone else has just acted on these results. Refresh the page.' });

    const o = sheet.offering;
    await this.audit.record({ action: stage.action, module: 'results', targetType: 'ResultSheet', targetId: id, metadata: { course: o.course.code, students: sheet.results.length } });

    if (stage.next === 'HOD_APPROVED') {
      await this.marks.notifyRole(ROLE_KEYS.DEAN, scopeValue('school', o.course.department.schoolId), o, 'approval as Dean');
    } else if (stage.next === 'DEAN_APPROVED') {
      await this.marks.notifyRole(ROLE_KEYS.EXAM_COORDINATOR, null, o, 'publication');
    } else {
      const students = await this.prisma.courseResult.findMany({ where: { sheetId: id }, select: { studentId: true } });
      await this.notifications.notify({
        eventKey: EVENT_KEYS.RESULTS_PUBLISHED,
        recipients: students.map((s) => ({ userId: s.studentId })),
        channels: ['IN_APP', 'EMAIL', 'SMS'],
        sharedVars: { courseCode: o.course.code, semesterLabel: `${o.semester.academicYear.label} ${termName(o.semester.number)}` },
        link: '/results',
      });
    }
    return this.get(user, id);
  }

  /** Sends the sheet back to the lecturers with a note. Marks become editable again. */
  async return(user: AuthUser, id: string, note: string) {
    const perms = await this.permissions(user);
    const sheet = await this.load(user, id);
    const stage = STAGES[sheet.status as keyof typeof STAGES];
    if (!stage || !perms.has(stage.permission)) {
      throw new ForbiddenException({ code: 'NOT_YOUR_STAGE', message: 'Only the person at the current approval stage can return these results.' });
    }
    const updated = await this.prisma.resultSheet.updateMany({
      where: { id, status: sheet.status },
      data: { status: 'DRAFT', returnNote: note.trim(), returnedAt: new Date(), returnedById: user.id },
    });
    if (updated.count !== 1) throw new ConflictException({ code: 'CHANGED', message: 'Someone else has just acted on these results. Refresh the page.' });

    const o = sheet.offering;
    await this.audit.record({ action: 'results.returned', module: 'results', targetType: 'ResultSheet', targetId: id, metadata: { course: o.course.code, fromStatus: sheet.status, note } });
    await this.notifications.notify({
      eventKey: EVENT_KEYS.RESULTS_RETURNED,
      recipients: o.lecturers.map((l) => ({ userId: l.user.id })),
      channels: ['IN_APP', 'EMAIL'],
      sharedVars: { courseCode: o.course.code, semesterLabel: `${o.semester.academicYear.label} ${termName(o.semester.number)}`, note, actor: user.label },
      link: `/teaching/${o.id}`,
    });
    return this.get(user, id);
  }

  private present(r: SheetRow, perms: Set<string>) {
    const stage = STAGES[r.status as keyof typeof STAGES];
    const { results, offering, ...rest } = r;
    return {
      ...rest,
      offering: {
        id: offering.id,
        course: offering.course,
        semesterLabel: `${offering.semester.academicYear.label} ${termName(offering.semester.number)}`,
        lecturers: offering.lecturers.map((l) => ({ name: `${l.user.firstName} ${l.user.lastName}`, isLead: l.isLead })),
      },
      summary: summarise(results),
      canAct: !!stage && perms.has(stage.permission),
      nextAction: stage ? (stage.next === 'PUBLISHED' ? 'publish' : 'approve') : null,
    };
  }

  private async load(user: AuthUser, id: string) {
    const sheet = await this.prisma.resultSheet.findUnique({ where: { id }, select: SHEET_SELECT });
    if (!sheet || sheet.status === 'DRAFT') throw new NotFoundException({ code: 'NOT_FOUND', message: 'Result sheet not found.' });
    await this.scope.assertDepartment(user, sheet.offering.course.department.id);
    return sheet;
  }

  private async permissions(user: AuthUser) {
    const perms = await this.resolver.permissionsFor(user.id, user.activeRoleKey);
    const allowed = [PERMISSIONS.RESULTS_APPROVE_DEPARTMENT, PERMISSIONS.RESULTS_APPROVE_SCHOOL, PERMISSIONS.RESULTS_PUBLISH, PERMISSIONS.RESULTS_READ_ALL];
    if (!allowed.some((p) => perms.has(p))) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'You do not have access to results.' });
    return perms;
  }
}
