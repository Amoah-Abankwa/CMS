import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { decideEligibility, ELIGIBILITY_REASON_TEXT, eligibilitySummary, type EligibilityPolicy, type EligibilityReason, type HoldCategory } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { SemestersService } from '../academics/semesters.service';
import { EligibilityListDto } from './dto/exams.dto';
import { AttendancePolicyService } from '../attendance/attendance-policy.service';
import { AttendanceSummaryService } from '../attendance/attendance-summary.service';

const POLICY_KEY = 'exams.eligibility_policy';
const DEFAULT_POLICY: EligibilityPolicy = { requireFinancialClearance: true, requireMinimumAttendance: true };

type Status = 'ELIGIBLE' | 'NOT_ELIGIBLE';

function effective(row: { status: Status; reasons: unknown; overrideStatus: Status | null }): { status: Status; reasons: EligibilityReason[] } {
  if (row.overrideStatus === 'NOT_ELIGIBLE') return { status: 'NOT_ELIGIBLE', reasons: ['OVERRIDE'] };
  if (row.overrideStatus === 'ELIGIBLE') return { status: 'ELIGIBLE', reasons: [] };
  return { status: row.status, reasons: row.reasons as EligibilityReason[] };
}

/**
 * Exam eligibility: generate decisions from the rules, review and override, then publish.
 * Students only ever see the published copy.
 */
@Injectable()
export class EligibilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly semesters: SemestersService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly attendancePolicy: AttendancePolicyService,
    private readonly attendance: AttendanceSummaryService,
  ) {}

  async policy(): Promise<EligibilityPolicy> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: POLICY_KEY } });
    return { ...DEFAULT_POLICY, ...((row?.value as Partial<EligibilityPolicy>) ?? {}) };
  }

  async setPolicy(policy: EligibilityPolicy) {
    const before = await this.policy();
    await this.prisma.systemSetting.upsert({ where: { key: POLICY_KEY }, create: { key: POLICY_KEY, value: { ...policy } }, update: { value: { ...policy } } });
    await this.audit.record({ action: 'exams.eligibility_policy_changed', module: 'exams', before, after: policy });
    return policy;
  }

  /** Recalculates every approved student and course from fee clearance, attendance and holds. Overrides are kept. */
  async generate(semesterId?: string) {
    const semester = await this.semesters.resolve(semesterId);
    const policy = await this.policy();
    const [attendanceRules, attendance] = await Promise.all([this.attendancePolicy.get(), this.attendance.summaries({ semesterId: semester.id })]);
    const [items, clearances, holds] = await Promise.all([
      this.prisma.courseRegistrationItem.findMany({
        where: { registration: { semesterId: semester.id, status: 'APPROVED' } },
        select: { offeringId: true, registration: { select: { studentId: true } } },
      }),
      this.prisma.financialClearance.findMany({ where: { semesterId: semester.id, cleared: true }, select: { studentId: true } }),
      this.prisma.examHold.findMany({ where: { semesterId: semester.id, liftedAt: null }, select: { studentId: true, offeringId: true, category: true } }),
    ]);
    const cleared = new Set(clearances.map((c) => c.studentId));
    const holdsBy = new Map<string, Array<{ offeringId: string | null; category: HoldCategory }>>();
    for (const h of holds) {
      if (!holdsBy.has(h.studentId)) holdsBy.set(h.studentId, []);
      holdsBy.get(h.studentId)!.push({ offeringId: h.offeringId, category: h.category });
    }

    const pairs = items.map((i) => ({ studentId: i.registration.studentId, offeringId: i.offeringId }));
    await this.prisma.$transaction(async (tx) => {
      // Students who dropped a course no longer need a decision for it.
      const keep = new Set(pairs.map((p) => `${p.studentId}:${p.offeringId}`));
      const existing = await tx.examEligibility.findMany({ where: { semesterId: semester.id }, select: { id: true, studentId: true, offeringId: true } });
      const stale = existing.filter((e) => !keep.has(`${e.studentId}:${e.offeringId}`)).map((e) => e.id);
      if (stale.length) await tx.examEligibility.deleteMany({ where: { id: { in: stale } } });

      for (const p of pairs) {
        const d = decideEligibility(
          p.offeringId,
          {
            feesCleared: cleared.has(p.studentId),
            holds: holdsBy.get(p.studentId) ?? [],
            attendancePercent: attendance.get(AttendanceSummaryService.key(p.studentId, p.offeringId))?.percent ?? null,
            minimumAttendancePercent: attendanceRules.minimumPercent,
          },
          policy,
        );
        const data = { status: (d.eligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE') as Status, reasons: d.reasons };
        await tx.examEligibility.upsert({
          where: { semesterId_studentId_offeringId: { semesterId: semester.id, studentId: p.studentId, offeringId: p.offeringId } },
          create: { semesterId: semester.id, ...p, ...data },
          update: data,
        });
      }
      await tx.examEligibilityList.upsert({ where: { semesterId: semester.id }, create: { semesterId: semester.id, generatedAt: new Date() }, update: { generatedAt: new Date() } });
    }, { timeout: 60_000 });

    await this.audit.record({ action: 'exams.eligibility_generated', module: 'exams', metadata: { semester: semester.label, decisions: pairs.length, policy } });
    return this.list({ semesterId: semester.id, page: 1, pageSize: 25 });
  }

  /** Grouped by student. Filters apply to the effective (rule or override) decision. */
  async list(q: EligibilityListDto) {
    const semester = await this.semesters.resolve(q.semesterId);
    const [meta, rows, policy] = await Promise.all([
      this.prisma.examEligibilityList.findUnique({ where: { semesterId: semester.id } }),
      this.prisma.examEligibility.findMany({
        where: {
          semesterId: semester.id,
          ...(q.search
            ? { student: { OR: [{ indexNumber: { contains: q.search, mode: 'insensitive' as const } }, { firstName: { contains: q.search, mode: 'insensitive' as const } }, { lastName: { contains: q.search, mode: 'insensitive' as const } }] } }
            : {}),
        },
        select: {
          id: true, status: true, reasons: true, overrideStatus: true, overrideReason: true, overriddenAt: true, publishedStatus: true, publishedReasons: true,
          student: { select: { id: true, indexNumber: true, firstName: true, lastName: true, studentProfile: { select: { programme: { select: { name: true } } } } } },
          offering: { select: { id: true, course: { select: { code: true, title: true } } } },
        },
      }),
      this.policy(),
    ]);

    type Row = (typeof rows)[number];
    const byStudent = new Map<string, { student: Row['student']; papers: Array<ReturnType<typeof present>> }>();
    const present = (r: Row) => {
      const eff = effective(r);
      const unpublished = r.publishedStatus !== eff.status || JSON.stringify(r.publishedReasons ?? null) !== JSON.stringify(eff.reasons);
      return {
        id: r.id,
        offering: r.offering,
        status: eff.status,
        reasons: eff.reasons.map((c) => ({ code: c, text: ELIGIBILITY_REASON_TEXT[c] ?? c })),
        ruleStatus: r.status,
        override: r.overrideStatus ? { status: r.overrideStatus, reason: r.overrideReason, at: r.overriddenAt } : null,
        publishedStatus: r.publishedStatus,
        unpublished,
      };
    };
    for (const r of rows) {
      if (!byStudent.has(r.student.id)) byStudent.set(r.student.id, { student: r.student, papers: [] });
      byStudent.get(r.student.id)!.papers.push(present(r));
    }
    let students = [...byStudent.values()]
      .map((s) => ({ ...s, papers: s.papers.sort((a, b) => a.offering.course.code.localeCompare(b.offering.course.code)), notEligible: s.papers.filter((p) => p.status === 'NOT_ELIGIBLE').length }))
      .sort((a, b) => (a.student.indexNumber ?? '').localeCompare(b.student.indexNumber ?? ''));

    const counts = {
      students: students.length,
      fullyEligible: students.filter((s) => s.notEligible === 0).length,
      withIssues: students.filter((s) => s.notEligible > 0).length,
      unpublished: students.filter((s) => s.papers.some((p) => p.unpublished)).length,
    };
    if (q.filter === 'NOT_ELIGIBLE') students = students.filter((s) => s.notEligible > 0);
    if (q.filter === 'ELIGIBLE') students = students.filter((s) => s.notEligible === 0);
    if (q.filter === 'UNPUBLISHED') students = students.filter((s) => s.papers.some((p) => p.unpublished));

    return {
      semester,
      policy,
      meta: { generatedAt: meta?.generatedAt ?? null, publishedAt: meta?.publishedAt ?? null, publishedVersion: meta?.publishedVersion ?? 0 },
      counts,
      total: students.length,
      page: q.page,
      pageSize: q.pageSize,
      items: students.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
    };
  }

  async override(user: AuthUser, id: string, status: Status, reason: string) {
    const row = await this.prisma.examEligibility.findUnique({ where: { id }, include: { student: { select: { indexNumber: true } }, offering: { select: { course: { select: { code: true } } } } } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Decision not found.' });
    await this.prisma.examEligibility.update({ where: { id }, data: { overrideStatus: status, overrideReason: reason.trim(), overriddenById: user.id, overriddenAt: new Date() } });
    await this.audit.record({ action: 'exams.eligibility_overridden', module: 'exams', targetType: 'ExamEligibility', targetId: id, metadata: { student: row.student.indexNumber, course: row.offering.course.code, ruleStatus: row.status, override: status, reason } });
    return { ok: true };
  }

  async clearOverride(id: string) {
    const row = await this.prisma.examEligibility.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Decision not found.' });
    await this.prisma.examEligibility.update({ where: { id }, data: { overrideStatus: null, overrideReason: null, overriddenById: null, overriddenAt: null } });
    await this.audit.record({ action: 'exams.eligibility_override_removed', module: 'exams', targetType: 'ExamEligibility', targetId: id });
    return { ok: true };
  }

  /** Publishes current decisions. Only students whose published status changed are notified. */
  async publish(semesterId?: string) {
    const semester = await this.semesters.resolve(semesterId);
    const rows = await this.prisma.examEligibility.findMany({
      where: { semesterId: semester.id },
      select: { studentId: true, status: true, reasons: true, overrideStatus: true, publishedStatus: true, publishedReasons: true, offering: { select: { course: { select: { code: true } } } } },
    });
    if (!rows.length) throw new ConflictException({ code: 'NOT_GENERATED', message: 'Generate the eligibility list before publishing.' });

    const byStudent = new Map<string, { total: number; blocked: Array<{ code: string; reasons: EligibilityReason[] }>; changed: boolean }>();
    for (const r of rows) {
      const eff = effective(r);
      const s = byStudent.get(r.studentId) ?? { total: 0, blocked: [], changed: false };
      s.total++;
      if (eff.status === 'NOT_ELIGIBLE') s.blocked.push({ code: r.offering.course.code, reasons: eff.reasons });
      if (r.publishedStatus !== eff.status || JSON.stringify(r.publishedReasons ?? null) !== JSON.stringify(eff.reasons)) s.changed = true;
      byStudent.set(r.studentId, s);
    }
    const toNotify = [...byStudent].filter(([, s]) => s.changed);
    if (!toNotify.length) throw new ConflictException({ code: 'NOTHING_CHANGED', message: 'Nothing has changed since the list was last published.' });

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.$executeRaw`
        UPDATE "ExamEligibility" SET
          "publishedStatus" = COALESCE("overrideStatus", "status"),
          "publishedReasons" = CASE
            WHEN "overrideStatus" IS NULL THEN "reasons"
            WHEN "overrideStatus" = 'NOT_ELIGIBLE' THEN '["OVERRIDE"]'::jsonb
            ELSE '[]'::jsonb END,
          "publishedAt" = ${now}
        WHERE "semesterId" = ${semester.id}::uuid`,
      this.prisma.examEligibilityList.upsert({
        where: { semesterId: semester.id },
        create: { semesterId: semester.id, publishedAt: now, publishedVersion: 1 },
        update: { publishedAt: now, publishedVersion: { increment: 1 } },
      }),
    ]);

    await this.notifications.notify({
      eventKey: EVENT_KEYS.EXAM_ELIGIBILITY_PUBLISHED,
      recipients: toNotify.map(([userId, s]) => ({
        userId,
        vars: {
          status: eligibilitySummary(s.total, s.blocked.length),
          reasonLine: s.blocked.length ? s.blocked.map((b) => `${b.code}: ${b.reasons.map((r) => ELIGIBILITY_REASON_TEXT[r]).join('; ')}`).join('\n') : 'You may sit all your papers.',
          smsReason: s.blocked.length ? 'Sign in to see why and what to do.' : '',
        },
      })),
      channels: ['IN_APP', 'EMAIL', 'SMS'],
      sharedVars: { semesterLabel: semester.label },
      link: '/exams',
    });
    await this.audit.record({ action: 'exams.eligibility_published', module: 'exams', metadata: { semester: semester.label, decisions: rows.length, studentsNotified: toNotify.length } });
    return { notified: toNotify.length };
  }
}
