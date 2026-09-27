import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { belowMinimum, checkInStatus } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { SemestersService } from '../academics/semesters.service';
import { AttendancePolicyService } from './attendance-policy.service';
import { AttendanceSummaryService } from './attendance-summary.service';
import { codeMatches } from './check-in-code';

@Injectable()
export class StudentAttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly semesters: SemestersService,
    private readonly policy: AttendancePolicyService,
    private readonly summary: AttendanceSummaryService,
    private readonly audit: AuditService,
  ) {}

  async mine(user: AuthUser) {
    this.assertStudent(user);
    const semester = await this.semesters.resolve();
    const [offerings, policy] = await Promise.all([
      this.prisma.courseOffering.findMany({
        where: { semesterId: semester.id, items: { some: { registration: { studentId: user.id, status: 'APPROVED' } } } },
        orderBy: { course: { code: 'asc' } },
        select: { id: true, course: { select: { code: true, title: true } } },
      }),
      this.policy.get(),
    ]);
    const ids = offerings.map((o) => o.id);
    const [summaries, records, upcoming] = await Promise.all([
      this.summary.summaries({ offeringIds: ids, studentId: user.id }),
      this.prisma.attendanceRecord.findMany({
        where: { studentId: user.id, session: { offeringId: { in: ids }, attendanceTakenAt: { not: null }, cancelledAt: null } },
        orderBy: { session: { startsAt: 'desc' } },
        select: { status: true, session: { select: { id: true, offeringId: true, startsAt: true, kind: true, topic: true } } },
      }),
      this.prisma.classSession.findMany({
        where: { offeringId: { in: ids }, cancelledAt: null, startsAt: { gte: new Date(Date.now() - 3 * 3_600_000) }, attendanceTakenAt: null },
        orderBy: { startsAt: 'asc' },
        take: 8,
        select: { id: true, offeringId: true, startsAt: true, durationMinutes: true, kind: true, venue: true, checkInClosesAt: true },
      }),
    ]);
    const now = new Date();
    return {
      semester: { id: semester.id, label: semester.label },
      policy: { minimumPercent: policy.minimumPercent },
      courses: offerings.map((o) => {
        const s = summaries.get(AttendanceSummaryService.key(user.id, o.id)) ?? null;
        return {
          offeringId: o.id,
          course: o.course,
          summary: s,
          belowMinimum: !!s && belowMinimum(s.percent, policy.minimumPercent),
          history: records.filter((r) => r.session.offeringId === o.id).map((r) => ({ ...r.session, status: r.status })),
        };
      }),
      upcoming: upcoming.map((u) => ({
        ...u,
        course: offerings.find((o) => o.id === u.offeringId)!.course,
        checkInOpen: !!u.checkInClosesAt && u.checkInClosesAt > now,
      })),
    };
  }

  /** The code on the lecturer's screen (or in the QR link) records the student as present or late. */
  async checkIn(user: AuthUser, code: string, sessionId?: string) {
    this.assertStudent(user);
    const now = new Date();
    const open = await this.prisma.classSession.findMany({
      where: {
        ...(sessionId ? { id: sessionId } : {}),
        cancelledAt: null,
        checkInSecret: { not: null },
        checkInClosesAt: { gt: now },
        offering: { items: { some: { registration: { studentId: user.id, status: 'APPROVED' } } } },
      },
      select: { id: true, startsAt: true, checkInSecret: true, offering: { select: { id: true, course: { select: { code: true, title: true } } } } },
    });
    const match = open.find((s) => codeMatches(s.checkInSecret!, code));
    if (!match) {
      await this.audit.record({ action: 'attendance.checkin_failed', module: 'attendance', result: 'FAILURE', metadata: { openClasses: open.length } });
      throw new BadRequestException({
        code: 'CODE_INVALID',
        message: open.length ? 'That code is not valid or has changed. Enter the code on the screen now.' : 'None of your classes has check-in open right now.',
      });
    }

    const existing = await this.prisma.attendanceRecord.findUnique({ where: { sessionId_studentId: { sessionId: match.id, studentId: user.id } } });
    if (existing && (existing.status === 'PRESENT' || existing.status === 'LATE')) {
      return { status: existing.status, course: match.offering.course, alreadyRecorded: true };
    }
    const policy = await this.policy.get();
    const status = checkInStatus(match.startsAt, now, policy.lateAfterMinutes);
    await this.prisma.attendanceRecord.upsert({
      where: { sessionId_studentId: { sessionId: match.id, studentId: user.id } },
      create: { sessionId: match.id, studentId: user.id, status, source: 'CHECK_IN', checkedInAt: now },
      update: { status, source: 'CHECK_IN', checkedInAt: now },
    });
    await this.audit.record({ action: 'attendance.checked_in', module: 'attendance', targetType: 'ClassSession', targetId: match.id, metadata: { course: match.offering.course.code, status } });
    return { status, course: match.offering.course, alreadyRecorded: false };
  }

  private assertStudent(user: AuthUser) {
    if (user.type !== 'STUDENT') throw new ForbiddenException({ code: 'STUDENTS_ONLY', message: 'This is for students.' });
  }
}
