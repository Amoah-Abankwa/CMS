import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ROLE_KEYS, scopeValue, courseTotalWithDevotion, DEVOTION_SHARE, termName } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { OfferingsService } from '../offerings/offerings.service';
import { GradingService } from './grading.service';
import { computeTotal, gradeFor, INCOMPLETE_GRADE, weightsProblem, type Mark } from './grading';
import { ComponentDto, MarkEntryDto } from './dto/results.dto';

/** Offered to a lecturer who has not set up assessments yet. Nothing is saved until they choose to. */
export const SUGGESTED_SCHEME: Array<Omit<ComponentDto, 'id'>> = [
  { name: 'Mid-semester test', kind: 'CONTINUOUS', weight: 20, maxScore: 50 },
  { name: 'Assignments', kind: 'CONTINUOUS', weight: 10, maxScore: 20 },
  { name: 'Quizzes', kind: 'CONTINUOUS', weight: 10, maxScore: 20 },
  { name: 'End of semester examination', kind: 'EXAM', weight: 60, maxScore: 100 },
];

/** Registrar's setting: morning devotion supplies the last 5% of every course (ANU policy; on unless switched off). */
export const DEVOTION_RULE_KEY = 'results.devotion';

const EDITABLE = ['DRAFT'];

/**
 * The lecturer's side of results: assessment scheme, marks entry, sharing continuous assessment
 * with students, and submitting final results for approval.
 * Any assigned lecturer or teaching assistant can enter marks. Only the lead lecturer changes the
 * scheme, shares marks and submits.
 */
@Injectable()
export class MarksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly offerings: OfferingsService,
    private readonly grading: GradingService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async workbook(user: AuthUser, offeringId: string) {
    const { offering, isLead } = await this.access(user, offeringId);
    const [students, assessments, sheet, scale] = await Promise.all([
      this.offerings.roster(offeringId),
      this.assessments(offeringId),
      this.prisma.resultSheet.findUnique({ where: { offeringId }, select: { status: true, returnNote: true, returnedAt: true, submittedAt: true, publishedAt: true } }),
      this.grading.active().catch(() => null),
    ]);
    const marks = await this.prisma.assessmentMark.findMany({
      where: { assessmentId: { in: assessments.map((a) => a.id) } },
      select: { assessmentId: true, studentId: true, score: true, absent: true },
    });
    const status = sheet?.status ?? 'DRAFT';
    return {
      offering: {
        id: offering.id,
        course: offering.course,
        semesterLabel: `${offering.semester.academicYear.label} ${termName(offering.semester.number)}`,
      },
      isLead,
      canEdit: EDITABLE.includes(status),
      sheet: { status, returnNote: sheet?.returnNote ?? null, returnedAt: sheet?.returnedAt ?? null, submittedAt: sheet?.submittedAt ?? null, publishedAt: sheet?.publishedAt ?? null },
      assessments,
      suggestedScheme: assessments.length ? null : (await this.devotionInTotals()) ? SUGGESTED_SCHEME.map((c) => (c.kind === 'EXAM' ? { ...c, weight: c.weight - DEVOTION_SHARE } : c)) : SUGGESTED_SCHEME,
      devotionInTotals: await this.devotionInTotals(),
      students,
      marks,
      scale,
    };
  }

  async saveScheme(user: AuthUser, offeringId: string, components: ComponentDto[]) {
    await this.access(user, offeringId, { lead: true, editable: true });
    const names = components.map((c) => c.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) throw new BadRequestException({ code: 'DUPLICATE_NAME', message: 'Each assessment needs a different name.' });
    const problem = weightsProblem(components.map((c, i) => ({ id: c.id ?? String(i), kind: c.kind, weight: c.weight, maxScore: c.maxScore })), (await this.devotionInTotals()) ? 100 - DEVOTION_SHARE : 100);
    if (problem) throw new BadRequestException({ code: 'WEIGHTS', message: problem });

    const existing = await this.prisma.assessment.findMany({
      where: { offeringId },
      select: { id: true, name: true, maxScore: true, _count: { select: { marks: { where: { OR: [{ score: { not: null } }, { absent: true }] } } } } },
    });
    const keep = new Set(components.filter((c) => c.id).map((c) => c.id!));
    const unknown = [...keep].filter((id) => !existing.some((e) => e.id === id));
    if (unknown.length) throw new BadRequestException({ code: 'UNKNOWN_ASSESSMENT', message: 'The page is out of date. Refresh and try again.' });

    const removed = existing.filter((e) => !keep.has(e.id));
    const withMarks = removed.find((e) => e._count.marks > 0);
    if (withMarks) throw new ConflictException({ code: 'HAS_MARKS', message: `"${withMarks.name}" already has marks. Clear them before removing it.` });

    for (const c of components.filter((c) => c.id)) {
      const highest = await this.prisma.assessmentMark.aggregate({ where: { assessmentId: c.id }, _max: { score: true } });
      if ((highest._max.score ?? 0) > c.maxScore) {
        throw new ConflictException({ code: 'MAX_TOO_LOW', message: `"${c.name}" has a mark of ${highest._max.score}. It cannot be marked out of less than that.` });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (removed.length) await tx.assessment.deleteMany({ where: { id: { in: removed.map((r) => r.id) } } });
      for (const [position, c] of components.entries()) {
        const data = { name: c.name.trim(), kind: c.kind, weight: c.weight, maxScore: c.maxScore, position };
        if (c.id) await tx.assessment.update({ where: { id: c.id }, data });
        else await tx.assessment.create({ data: { ...data, offeringId } });
      }
    });
    await this.audit.record({ action: 'marks.scheme_saved', module: 'results', targetType: 'CourseOffering', targetId: offeringId, after: components });
    return this.workbook(user, offeringId);
  }

  async saveMarks(user: AuthUser, offeringId: string, entries: MarkEntryDto[]) {
    await this.access(user, offeringId, { editable: true });
    const [assessments, roster] = await Promise.all([this.assessments(offeringId), this.offerings.roster(offeringId)]);
    const byId = new Map(assessments.map((a) => [a.id, a]));
    const onRoster = new Set(roster.map((s) => s.id));

    for (const e of entries) {
      const a = byId.get(e.assessmentId);
      if (!a || !onRoster.has(e.studentId)) throw new BadRequestException({ code: 'STALE', message: 'The page is out of date. Refresh and try again.' });
      if (e.score !== null && e.score > a.maxScore) {
        throw new BadRequestException({ code: 'SCORE_TOO_HIGH', message: `A mark of ${e.score} is higher than the maximum of ${a.maxScore} for "${a.name}".` });
      }
    }

    const now = new Date();
    await this.prisma.$transaction([
      ...entries.map((e) => {
        const data = { score: e.absent ? null : e.score, absent: e.absent, enteredById: user.id };
        return this.prisma.assessmentMark.upsert({
          where: { assessmentId_studentId: { assessmentId: e.assessmentId, studentId: e.studentId } },
          create: { assessmentId: e.assessmentId, studentId: e.studentId, ...data },
          update: data,
        });
      }),
      this.prisma.assessment.updateMany({ where: { id: { in: [...new Set(entries.map((e) => e.assessmentId))] } }, data: { marksUpdatedAt: now } }),
    ]);
    await this.audit.record({
      action: 'marks.saved',
      module: 'results',
      targetType: 'CourseOffering',
      targetId: offeringId,
      metadata: { entries: entries.length, assessments: [...new Set(entries.map((e) => byId.get(e.assessmentId)!.name))] },
    });
    return this.workbook(user, offeringId);
  }

  /** Shares a continuous assessment with students (a snapshot) and sends the "internal marks updated" alert. */
  async release(user: AuthUser, offeringId: string, assessmentId: string) {
    const { offering } = await this.access(user, offeringId, { lead: true });
    const a = await this.prisma.assessment.findFirst({ where: { id: assessmentId, offeringId } });
    if (!a) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Assessment not found.' });
    if (a.kind !== 'CONTINUOUS') throw new BadRequestException({ code: 'EXAM_NOT_SHAREABLE', message: 'Exam marks reach students only when results are published.' });
    if (!a.marksUpdatedAt) throw new BadRequestException({ code: 'NO_MARKS', message: 'Enter marks before sharing them.' });
    if (a.releasedAt && a.marksUpdatedAt <= a.releasedAt) {
      throw new ConflictException({ code: 'NOTHING_NEW', message: 'Students already have the latest marks for this assessment.' });
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.$executeRaw`
        UPDATE "AssessmentMark" SET "releasedScore" = "score", "releasedAbsent" = "absent", "releasedAt" = ${now}
        WHERE "assessmentId" = ${assessmentId}::uuid AND ("score" IS NOT NULL OR "absent" = true)`,
      this.prisma.assessment.update({ where: { id: assessmentId }, data: { releasedAt: now } }),
    ]);

    const recipients = await this.prisma.assessmentMark.findMany({ where: { assessmentId, releasedAt: now }, select: { studentId: true } });
    await this.notifications.notify({
      eventKey: EVENT_KEYS.INTERNALS_UPDATED,
      recipients: recipients.map((r) => ({ userId: r.studentId })),
      channels: ['IN_APP', 'EMAIL', 'SMS'],
      sharedVars: { courseCode: offering.course.code, assessmentName: a.name },
      link: '/results',
    });
    await this.audit.record({ action: 'marks.shared', module: 'results', targetType: 'Assessment', targetId: assessmentId, metadata: { course: offering.course.code, students: recipients.length } });
    return this.workbook(user, offeringId);
  }

  /** Calculates every student's result with the active scale and sends the sheet for approval. */
  private async devotionInTotals() {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: DEVOTION_RULE_KEY } });
    return (row?.value as { inTotals?: boolean } | null)?.inTotals ?? true;
  }

  async submit(user: AuthUser, offeringId: string) {
    const { offering } = await this.access(user, offeringId, { lead: true, editable: true });
    const [assessments, roster, scale] = await Promise.all([this.assessments(offeringId), this.offerings.roster(offeringId), this.grading.active()]);
    const withDevotion = await this.devotionInTotals();
    const problem = weightsProblem(assessments, withDevotion ? 100 - DEVOTION_SHARE : 100);
    if (problem) throw new BadRequestException({ code: 'WEIGHTS', message: problem });
    if (roster.length === 0) throw new BadRequestException({ code: 'NO_STUDENTS', message: 'There are no approved students in this course.' });

    const marks = await this.prisma.assessmentMark.findMany({ where: { assessmentId: { in: assessments.map((a) => a.id) } } });
    const byStudent = new Map<string, Map<string, Mark>>();
    for (const m of marks) {
      if (!byStudent.has(m.studentId)) byStudent.set(m.studentId, new Map());
      byStudent.get(m.studentId)!.set(m.assessmentId, { score: m.score, absent: m.absent });
    }

    const rows = roster.map((s) => ({ student: s, ...computeTotal(assessments, byStudent.get(s.id) ?? new Map()) }));
    const incompleteEntry = rows.filter((r) => r.missing > 0);
    if (incompleteEntry.length) {
      throw new BadRequestException({
        code: 'MARKS_MISSING',
        message: `${incompleteEntry.length} student${incompleteEntry.length === 1 ? ' is' : 's are'} missing marks, for example ${incompleteEntry[0].student.indexNumber}. Enter a mark or type ABS for absent.`,
      });
    }

    // Morning devotion: add each student's semester score, or scale weekend students (exempt) from 95 to 100.
    const devotionOf = new Map<string, { score: number } | { exempt: true }>();
    if (withDevotion) {
      const ids = rows.map((r) => r.student.id);
      const [profiles, finalised, exempted] = await Promise.all([
        this.prisma.studentProfile.findMany({ where: { userId: { in: ids } }, select: { userId: true, programme: { select: { level: { select: { mode: true } } } } } }),
        this.prisma.devotionResult.findMany({ where: { semesterId: offering.semesterId, studentId: { in: ids } }, select: { studentId: true, score: true } }),
        this.prisma.devotionExemption.findMany({ where: { semesterId: offering.semesterId, studentId: { in: ids } }, select: { studentId: true } }),
      ]);
      // Weekend students and those the Chaplaincy has exempted are scaled from 95 to 100.
      const weekend = new Set([...profiles.filter((p) => p.programme.level.mode === 'WEEKEND').map((p) => p.userId), ...exempted.map((e) => e.studentId)]);
      const score = new Map(finalised.map((d) => [d.studentId, d.score]));
      const missing = ids.filter((id) => !weekend.has(id) && !score.has(id));
      if (missing.length) {
        const example = rows.find((r) => r.student.id === missing[0])!.student.indexNumber;
        throw new BadRequestException({ code: 'DEVOTION_NOT_FINAL', message: `Morning devotion scores are not finalised for ${missing.length} student${missing.length === 1 ? '' : 's'} (for example ${example}). The Chaplaincy finalises them under Devotion scores; then submit again.` });
      }
      for (const id of ids) devotionOf.set(id, weekend.has(id) ? { exempt: true } : { score: score.get(id)! });
    }
    for (const r of rows) {
      const d = devotionOf.get(r.student.id);
      if (d && !r.incomplete) r.total = courseTotalWithDevotion(r.caScore + r.examScore, d);
    }

    const credits = offering.course.creditHours;
    await this.prisma.$transaction(async (tx) => {
      const sheet = await tx.resultSheet.upsert({
        where: { offeringId },
        create: { offeringId, status: 'SUBMITTED', scaleId: scale.id, submittedAt: new Date(), submittedById: user.id },
        update: {
          status: 'SUBMITTED', scaleId: scale.id, submittedAt: new Date(), submittedById: user.id,
          hodApprovedAt: null, hodApprovedById: null, deanApprovedAt: null, deanApprovedById: null, returnNote: null, returnedAt: null, returnedById: null,
        },
      });
      await tx.courseResult.deleteMany({ where: { sheetId: sheet.id } });
      await tx.courseResult.createMany({
        data: rows.map((r) => {
          const band = gradeFor(r.total, scale.bands);
          return {
            sheetId: sheet.id,
            studentId: r.student.id,
            credits,
            caScore: r.caScore,
            examScore: r.examScore,
            total: r.total,
            grade: r.incomplete ? INCOMPLETE_GRADE : band.letter,
            gradePoint: r.incomplete ? 0 : band.gradePoint,
            isPass: r.incomplete ? false : band.isPass,
            incomplete: r.incomplete,
            devotionScore: (() => { const d = devotionOf.get(r.student.id); return d && 'score' in d ? d.score : null; })(),
            devotionExempt: (() => { const d = devotionOf.get(r.student.id); return !!d && 'exempt' in d; })(),
          };
        }),
      });
    });

    await this.audit.record({ action: 'results.submitted', module: 'results', targetType: 'CourseOffering', targetId: offeringId, metadata: { course: offering.course.code, students: rows.length, scaleVersion: scale.version } });
    await this.notifyRole(ROLE_KEYS.HEAD_OF_DEPARTMENT, scopeValue('department', offering.course.department.id), offering, 'approval as Head of Department');
    return this.workbook(user, offeringId);
  }

  /** Tells the holders of the next approving role that a sheet is waiting. */
  async notifyRole(roleKey: string, scope: string | null, offering: { course: { code: string; title: string }; semester: { number: number; academicYear: { label: string } } }, stage: string) {
    const holders = await this.prisma.userRole.findMany({
      where: { role: { key: roleKey }, scope, user: { status: 'ACTIVE' } },
      select: { userId: true },
    });
    if (!holders.length) return;
    await this.notifications.notify({
      eventKey: EVENT_KEYS.RESULTS_AWAITING_APPROVAL,
      recipients: holders.map((h) => ({ userId: h.userId })),
      channels: ['IN_APP', 'EMAIL'],
      sharedVars: {
        courseCode: offering.course.code,
        courseTitle: offering.course.title,
        semesterLabel: `${offering.semester.academicYear.label} ${termName(offering.semester.number)}`,
        stage,
      },
      link: '/academics/results',
    });
  }

  private assessments(offeringId: string) {
    return this.prisma.assessment.findMany({
      where: { offeringId },
      orderBy: { position: 'asc' },
      select: { id: true, name: true, kind: true, weight: true, maxScore: true, position: true, releasedAt: true, marksUpdatedAt: true },
    });
  }

  /** The person must be assigned to teach the course. Some actions need the lead lecturer or an editable sheet. */
  private async access(user: AuthUser, offeringId: string, need: { lead?: boolean; editable?: boolean } = {}) {
    const offering = await this.prisma.courseOffering.findUnique({
      where: { id: offeringId },
      select: {
        id: true, semesterId: true,
        course: { select: { code: true, title: true, creditHours: true, department: { select: { id: true, schoolId: true } } } },
        semester: { select: { number: true, academicYear: { select: { label: true } } } },
        lecturers: { where: { userId: user.id }, select: { isLead: true } },
        resultSheet: { select: { status: true } },
      },
    });
    if (!offering) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Course not found.' });
    const assignment = offering.lecturers[0];
    if (!assignment) throw new ForbiddenException({ code: 'NOT_YOUR_CLASS', message: 'You are not assigned to teach this course.' });
    if (need.lead && !assignment.isLead) throw new ForbiddenException({ code: 'LEAD_ONLY', message: 'Only the lead lecturer can do this.' });
    const status = offering.resultSheet?.status ?? 'DRAFT';
    if (need.editable && !EDITABLE.includes(status)) {
      throw new ConflictException({
        code: 'SHEET_LOCKED',
        message: status === 'PUBLISHED' ? 'Results for this course are published and can no longer be changed.' : 'Results are with the approvers. They must return them before marks can change.',
      });
    }
    return { offering, isLead: assignment.isLead };
  }
}
