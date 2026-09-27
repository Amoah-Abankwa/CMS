import { Injectable } from '@nestjs/common';
import { belowMinimum, summariseAttendance, type AttendanceStatus } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { AttendancePolicyService } from './attendance-policy.service';

export type Summary = ReturnType<typeof summariseAttendance>;
const key = (studentId: string, offeringId: string) => `${studentId}:${offeringId}`;

/** Attendance percentages, low-attendance warnings and excused-absence bookkeeping. */
@Injectable()
export class AttendanceSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AttendancePolicyService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Summaries keyed "studentId:offeringId", counting only classes where attendance was taken. */
  async summaries(where: { offeringIds?: string[]; semesterId?: string; studentId?: string }) {
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        ...(where.studentId ? { studentId: where.studentId } : {}),
        session: {
          attendanceTakenAt: { not: null },
          cancelledAt: null,
          ...(where.offeringIds ? { offeringId: { in: where.offeringIds } } : {}),
          ...(where.semesterId ? { offering: { semesterId: where.semesterId } } : {}),
        },
      },
      select: { studentId: true, status: true, session: { select: { offeringId: true } } },
    });
    const grouped = new Map<string, AttendanceStatus[]>();
    for (const r of records) {
      const k = key(r.studentId, r.session.offeringId);
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k)!.push(r.status);
    }
    return new Map([...grouped].map(([k, statuses]) => [k, summariseAttendance(statuses)]));
  }

  static key = key;

  /**
   * Warns students who have fallen below the minimum (once, after enough classes), and forgets the
   * warning when they recover so a later drop warns again.
   */
  async evaluateWarnings(offeringId: string) {
    const policy = await this.policy.get();
    const offering = await this.prisma.courseOffering.findUniqueOrThrow({ where: { id: offeringId }, select: { course: { select: { code: true, title: true } } } });
    const summaries = await this.summaries({ offeringIds: [offeringId] });
    const warned = new Set((await this.prisma.attendanceWarning.findMany({ where: { offeringId }, select: { studentId: true } })).map((w) => w.studentId));

    const toWarn: Array<{ studentId: string; percent: number }> = [];
    const recovered: string[] = [];
    for (const [k, s] of summaries) {
      const studentId = k.split(':')[0];
      const low = s.counted >= policy.warnAfterSessions && belowMinimum(s.percent, policy.minimumPercent);
      if (low && !warned.has(studentId)) toWarn.push({ studentId, percent: s.percent! });
      if (!low && warned.has(studentId)) recovered.push(studentId);
    }
    if (recovered.length) await this.prisma.attendanceWarning.deleteMany({ where: { offeringId, studentId: { in: recovered } } });
    if (!toWarn.length) return;

    await this.prisma.attendanceWarning.createMany({ data: toWarn.map((w) => ({ offeringId, studentId: w.studentId, percent: w.percent })), skipDuplicates: true });
    await this.notifications.notify({
      eventKey: EVENT_KEYS.ATTENDANCE_LOW,
      recipients: toWarn.map((w) => ({ userId: w.studentId, vars: { percent: w.percent } })),
      channels: ['IN_APP', 'EMAIL', 'SMS'],
      sharedVars: { courseCode: offering.course.code, courseTitle: offering.course.title, minimum: policy.minimumPercent },
      link: '/attendance',
    });
  }

  /** Active excuses covering a class date, as a set of student ids. */
  async excusedOn(studentIds: string[], at: Date) {
    const day = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
    const rows = await this.prisma.attendanceExcuse.findMany({
      where: { studentId: { in: studentIds }, revokedAt: null, fromDate: { lte: day }, toDate: { gte: day } },
      select: { studentId: true },
    });
    return new Set(rows.map((r) => r.studentId));
  }

  /**
   * Re-applies a student's excuses to classes in a date range: absences inside an active excuse become
   * excused, and excused records no longer covered by any excuse go back to absent.
   * Returns the courses affected so their warnings can be re-evaluated.
   */
  async reapplyExcuses(studentId: string, from: Date, to: Date) {
    const end = new Date(to.getTime() + 86_400_000);
    const [records, excuses] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { studentId, status: { in: ['ABSENT', 'EXCUSED'] }, session: { startsAt: { gte: from, lt: end } } },
        select: { sessionId: true, status: true, source: true, session: { select: { startsAt: true, offeringId: true } } },
      }),
      this.prisma.attendanceExcuse.findMany({ where: { studentId, revokedAt: null }, select: { fromDate: true, toDate: true } }),
    ]);
    const covered = (d: Date) => {
      const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      return excuses.some((e) => e.fromDate.getTime() <= day && day <= e.toDate.getTime());
    };
    const affected = new Set<string>();
    for (const r of records) {
      const shouldExcuse = covered(r.session.startsAt);
      if (shouldExcuse && r.status === 'ABSENT') {
        await this.prisma.attendanceRecord.update({ where: { sessionId_studentId: { sessionId: r.sessionId, studentId } }, data: { status: 'EXCUSED', source: 'EXCUSE' } });
        affected.add(r.session.offeringId);
      } else if (!shouldExcuse && r.status === 'EXCUSED' && r.source === 'EXCUSE') {
        await this.prisma.attendanceRecord.update({ where: { sessionId_studentId: { sessionId: r.sessionId, studentId } }, data: { status: 'ABSENT', source: 'LECTURER' } });
        affected.add(r.session.offeringId);
      }
    }
    for (const offeringId of affected) await this.evaluateWarnings(offeringId);

    // The same excuse covers morning devotion in those dates.
    const devotion = await this.prisma.devotionRecord.findMany({
      where: { studentId, status: { in: ['ABSENT', 'EXCUSED'] }, service: { date: { gte: from, lte: to } } },
      select: { serviceId: true, status: true, source: true, service: { select: { date: true } } },
    });
    for (const r of devotion) {
      const shouldExcuse = covered(r.service.date);
      if (shouldExcuse && r.status === 'ABSENT') {
        await this.prisma.devotionRecord.update({ where: { serviceId_studentId: { serviceId: r.serviceId, studentId } }, data: { status: 'EXCUSED', source: 'EXCUSE' } });
      } else if (!shouldExcuse && r.status === 'EXCUSED' && r.source === 'EXCUSE') {
        await this.prisma.devotionRecord.update({ where: { serviceId_studentId: { serviceId: r.serviceId, studentId } }, data: { status: 'ABSENT', source: 'CLOSE' } });
      }
    }
    return affected.size;
  }
}
