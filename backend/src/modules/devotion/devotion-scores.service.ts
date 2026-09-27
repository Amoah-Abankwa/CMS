import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { devotionScore, type DevotionStatus } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { SemestersService } from '../academics/semesters.service';
import { DevotionPolicyService } from './devotion-policy.service';
import { DevotionServicesService } from './devotion-services.service';
import { ScoresQuery } from './dto/devotion.dto';

/** Running scores out of the configured total, and the end-of-semester finalised score. */
@Injectable()
export class DevotionScoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly semesters: SemestersService,
    private readonly policy: DevotionPolicyService,
    private readonly services: DevotionServicesService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Statuses per student from closed, non-cancelled services, plus live ones they have already arrived at. */
  private async statuses(semesterId: string, studentIds?: string[]) {
    const records = await this.prisma.devotionRecord.findMany({
      where: { ...(studentIds ? { studentId: { in: studentIds } } : {}), service: { semesterId, cancelledAt: null } },
      select: { studentId: true, status: true },
    });
    const map = new Map<string, DevotionStatus[]>();
    for (const r of records) {
      if (!map.has(r.studentId)) map.set(r.studentId, []);
      map.get(r.studentId)!.push(r.status);
    }
    return map;
  }

  async list(q: ScoresQuery) {
    const semester = await this.semesters.resolve(q.semesterId);
    const policy = await this.policy.get();
    const students = await this.prisma.user.findMany({
      where: {
        ...this.services.expectedWhere(semester.id),
        ...(q.search
          ? { OR: [{ indexNumber: { contains: q.search, mode: 'insensitive' as const } }, { firstName: { contains: q.search, mode: 'insensitive' as const } }, { lastName: { contains: q.search, mode: 'insensitive' as const } }] }
          : {}),
      },
      orderBy: { indexNumber: 'asc' },
      select: {
        id: true, indexNumber: true, firstName: true, lastName: true,
        studentProfile: { select: { currentLevel: true, programme: { select: { name: true } } } },
        devotionResults: { where: { semesterId: semester.id }, select: { score: true, finalizedAt: true } },
      },
    });
    const statuses = await this.statuses(semester.id, students.map((s) => s.id));
    const rows = students
      .map(({ devotionResults, ...s }) => ({ ...s, ...devotionScore(statuses.get(s.id) ?? [], policy), finalScore: devotionResults[0]?.score ?? null }))
      .sort((a, b) => (a.score ?? 99) - (b.score ?? 99));
    const scored = rows.filter((r) => r.score !== null);
    const finalised = await this.prisma.devotionResult.findFirst({ where: { semesterId: semester.id }, orderBy: { finalizedAt: 'desc' }, select: { finalizedAt: true } });
    return {
      semester,
      policy,
      finalizedAt: finalised?.finalizedAt ?? null,
      stats: {
        students: rows.length,
        average: scored.length ? Math.round((scored.reduce((a, r) => a + r.score!, 0) / scored.length) * 100) / 100 : null,
        full: scored.filter((r) => r.score === policy.totalMarks).length,
      },
      total: rows.length,
      page: q.page,
      pageSize: q.pageSize,
      items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
    };
  }

  /**
   * Fixes each student's score for the semester and tells them. Can be run again after corrections;
   * then only students whose score changed are told.
   */
  async finalise(user: AuthUser, semesterId?: string) {
    const semester = await this.semesters.resolve(semesterId);
    const policy = await this.policy.get();
    const open = await this.prisma.devotionService.count({ where: { semesterId: semester.id, cancelledAt: null, closedAt: null, date: { lte: new Date() } } });
    if (open) throw new ConflictException({ code: 'SERVICES_OPEN', message: `${open} past ${open === 1 ? 'service is' : 'services are'} not closed yet. Close them first.` });

    const students = await this.prisma.user.findMany({
      where: this.services.expectedWhere(semester.id),
      select: { id: true, devotionResults: { where: { semesterId: semester.id }, select: { score: true } } },
    });
    const statuses = await this.statuses(semester.id);
    const now = new Date();
    const changed: Array<{ userId: string; vars: Record<string, string | number> }> = [];
    for (const s of students) {
      const r = devotionScore(statuses.get(s.id) ?? [], policy);
      const score = r.score ?? policy.totalMarks; // No services counted (all excused): full marks.
      const data = { score, totalMarks: policy.totalMarks, early: r.early, late: r.late, absent: r.absent, excused: r.excused, finalizedAt: now, finalizedById: user.id };
      await this.prisma.devotionResult.upsert({
        where: { studentId_semesterId: { studentId: s.id, semesterId: semester.id } },
        create: { studentId: s.id, semesterId: semester.id, ...data },
        update: data,
      });
      if (s.devotionResults[0]?.score !== score) {
        changed.push({ userId: s.id, vars: { score: score.toFixed(2), early: r.early, late: r.late, absent: r.absent, excused: r.excused } });
      }
    }
    await this.notifications.notify({
      eventKey: EVENT_KEYS.DEVOTION_FINAL,
      recipients: changed,
      channels: ['IN_APP', 'EMAIL', 'SMS'],
      sharedVars: { semesterLabel: semester.label, totalMarks: policy.totalMarks.toFixed(2) },
      link: '/devotion',
    });
    await this.audit.record({ action: 'devotion.scores_finalised', module: 'devotion', metadata: { semester: semester.label, students: students.length, notified: changed.length } });
    return { students: students.length, notified: changed.length };
  }

  async mine(user: AuthUser) {
    if (user.type !== 'STUDENT') throw new ForbiddenException({ code: 'STUDENTS_ONLY', message: 'This page is for students.' });
    const semester = await this.semesters.resolve();
    const policy = await this.policy.get();
    const [expected, records, result, next] = await Promise.all([
      this.prisma.user.count({ where: { id: user.id, ...this.services.expectedWhere(semester.id) } }),
      this.prisma.devotionRecord.findMany({
        where: { studentId: user.id, service: { semesterId: semester.id, cancelledAt: null } },
        orderBy: { service: { date: 'desc' } },
        select: { status: true, arrivedAt: true, service: { select: { id: true, date: true, theme: true } } },
      }),
      this.prisma.devotionResult.findUnique({ where: { studentId_semesterId: { studentId: user.id, semesterId: semester.id } } }),
      this.prisma.devotionService.findFirst({
        where: { semesterId: semester.id, cancelledAt: null, closedAt: null, endsAt: { gt: new Date() } },
        orderBy: { date: 'asc' },
        select: { id: true, date: true, opensAt: true, startsAt: true, lateFrom: true, endsAt: true, theme: true },
      }),
    ]);
    return {
      semester: { id: semester.id, label: semester.label },
      expected: expected > 0,
      policy,
      summary: devotionScore(records.map((r) => r.status), policy),
      final: result ? { score: result.score, totalMarks: result.totalMarks, finalizedAt: result.finalizedAt } : null,
      history: records.map((r) => ({ ...r.service, status: r.status, arrivedAt: r.arrivedAt })),
      next,
    };
  }
}
