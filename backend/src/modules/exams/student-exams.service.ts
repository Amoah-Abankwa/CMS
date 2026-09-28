import { ForbiddenException, Injectable } from '@nestjs/common';
import { ELIGIBILITY_REASON_TEXT, type EligibilityReason } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { SemestersService } from '../academics/semesters.service';
import type { PublishedPaper } from './timetable.service';

/** A student's papers: the published timetable and published eligibility only. */
@Injectable()
export class StudentExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly semesters: SemestersService,
  ) {}

  async mine(user: AuthUser, semesterId?: string) {
    if (user.type !== 'STUDENT') throw new ForbiddenException({ code: 'STUDENTS_ONLY', message: 'This page is for students.' });
    const semester = await this.semesters.resolve(semesterId);
    const [offerings, timetable, eligibility, list] = await Promise.all([
      this.prisma.courseOffering.findMany({
        where: { semesterId: semester.id, items: { some: { registration: { studentId: user.id, status: 'APPROVED' } } } },
        select: { id: true, course: { select: { code: true, title: true, creditHours: true } } },
      }),
      this.prisma.examTimetable.findUnique({ where: { semesterId: semester.id }, select: { publishedAt: true, publishedSnapshot: true } }),
      this.prisma.examEligibility.findMany({ where: { semesterId: semester.id, studentId: user.id, publishedAt: { not: null } }, select: { offeringId: true, publishedStatus: true, publishedReasons: true } }),
      this.prisma.examEligibilityList.findUnique({ where: { semesterId: semester.id }, select: { publishedAt: true } }),
    ]);
    const seats = await this.prisma.examSeat.findMany({ where: { studentId: user.id, session: { offeringId: { in: offerings.map((o) => o.id) } } }, select: { seatNumber: true, session: { select: { offeringId: true } } } });
    const seatOf = new Map(seats.map((s) => [s.session.offeringId, s.seatNumber]));
const snapshot =
  (timetable?.publishedSnapshot ?? {}) as unknown as Record<
    string,
    PublishedPaper
  >;    const decisions = new Map(eligibility.map((e) => [e.offeringId, e]));

    const papers = offerings
      .map((o) => {
        const exam = snapshot[o.id] ?? null;
        const d = decisions.get(o.id);
        return {
          offeringId: o.id,
          course: o.course,
          exam,
          seatNumber: seatOf.get(o.id) ?? null,
          eligibility: d?.publishedStatus
            ? { status: d.publishedStatus, reasons: ((d.publishedReasons as EligibilityReason[]) ?? []).map((c) => ELIGIBILITY_REASON_TEXT[c] ?? c) }
            : null,
        };
      })
      .sort((a, b) => (a.exam?.startsAt ?? '9').localeCompare(b.exam?.startsAt ?? '9') || a.course.code.localeCompare(b.course.code));

    return {
      semester: { id: semester.id, label: semester.label },
      timetablePublishedAt: timetable?.publishedAt ?? null,
      eligibilityPublishedAt: list?.publishedAt ?? null,
      papers,
    };
  }
}
