import { ScopeService } from '../rbac/scope.service';
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PERMISSIONS } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { PermissionResolverService } from '../rbac/permission-resolver.service';

const when = (d: Date) => d.toLocaleString('en-GB', { timeZone: 'Africa/Accra', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Seats, invigilation duties and the exam attendance register. The Exams Office allocates seats and
 * notifies invigilators; each invigilator marks the register for the papers they are assigned to.
 */
@Injectable()
export class ExamRegisterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: PermissionResolverService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly scope: ScopeService,
  ) {}

  /** Students sitting a paper: approved registrations for the offering. */
  private async candidates(offeringId: string) {
    const items = await this.prisma.courseRegistrationItem.findMany({
      where: { offeringId, registration: { status: 'APPROVED' } },
      select: { registration: { select: { student: { select: { id: true, indexNumber: true } } } } },
    });
    return items.map((i) => i.registration.student).sort((a, b) => (a.indexNumber ?? '').localeCompare(b.indexNumber ?? ''));
  }

  /**
   * Numbers seats for every paper in a timetable. Papers sharing a hall at the same time get
   * consecutive ranges, so no two candidates in a room share a number. Re-running renumbers.
   */
  async allocateSeats(user: AuthUser, timetableId: string) {
    const sessions = await this.prisma.examSession.findMany({ where: { timetableId }, orderBy: [{ startsAt: 'asc' }], select: { id: true, offeringId: true, startsAt: true, venueId: true, venue: { select: { name: true, capacity: true } }, offering: { select: { course: { select: { code: true } } } } } });
    const groups = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const key = `${s.venueId ?? 'none'}|${s.startsAt.toISOString()}`;
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    const overfull: string[] = [];
    let seated = 0;
    for (const group of groups.values()) {
      group.sort((a, b) => a.offering.course.code.localeCompare(b.offering.course.code));
      let next = 1;
      for (const s of group) {
        const students = await this.candidates(s.offeringId);
        await this.prisma.$transaction([
          this.prisma.examSeat.deleteMany({ where: { sessionId: s.id } }),
          this.prisma.examSeat.createMany({ data: students.map((st, i) => ({ sessionId: s.id, studentId: st.id, seatNumber: next + i })) }),
        ]);
        next += students.length;
        seated += students.length;
      }
      const venue = group[0].venue;
      if (venue && next - 1 > venue.capacity) overfull.push(`${venue.name} at ${when(group[0].startsAt)} (${next - 1} for ${venue.capacity} seats)`);
    }
    await this.audit.record({ action: 'exams.seats_allocated', module: 'exams', targetType: 'ExamTimetable', targetId: timetableId, metadata: { seated, papers: sessions.length, overfull } });
    return { seated, papers: sessions.length, overfull };
  }

  /** Sends each invigilator the list of papers they invigilate. */
  async notifyInvigilators(timetableId: string) {
    const rows = await this.prisma.examInvigilator.findMany({
      where: { session: { timetableId } },
      select: { userId: true, session: { select: { startsAt: true, durationMinutes: true, venue: { select: { name: true } }, offering: { select: { course: { select: { code: true, title: true } } } } } } },
    });
    const byUser = new Map<string, typeof rows>();
    for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
    for (const [userId, duties] of byUser) {
      duties.sort((a, b) => a.session.startsAt.getTime() - b.session.startsAt.getTime());
      const lines = duties.map((d) => `${when(d.session.startsAt)}, ${d.session.durationMinutes} min, ${d.session.venue?.name ?? 'venue to be confirmed'}: ${d.session.offering.course.code} ${d.session.offering.course.title}`);
      await this.notifications.notify({
        eventKey: EVENT_KEYS.INVIGILATION_DUTY,
        recipients: [{ userId }],
        channels: ['IN_APP', 'EMAIL', 'SMS'],
        sharedVars: { count: duties.length, duties: lines.join('\n'), first: lines[0] },
        link: '/exams/register',
      });
    }
    await this.audit.record({ action: 'exams.invigilators_notified', module: 'exams', targetType: 'ExamTimetable', targetId: timetableId, metadata: { invigilators: byUser.size } });
    return { invigilators: byUser.size };
  }

  private async canManage(user: AuthUser) {
    return (await this.resolver.permissionsFor(user.id, user.activeRoleKey)).has(PERMISSIONS.EXAMS_MANAGE);
  }

  private async assertAccess(user: AuthUser, sessionId: string) {
    if (await this.canManage(user)) return;
    const assigned = await this.prisma.examInvigilator.count({ where: { sessionId, userId: user.id } });
    if (!assigned) throw new ForbiddenException({ code: 'NOT_INVIGILATOR', message: 'You are not invigilating this paper.' });
  }

  /** Papers the person invigilates (or all, for the Exams Office), from yesterday onwards. */
  async mySessions(user: AuthUser) {
    const from = new Date(Date.now() - 86_400_000);
    const manage = await this.canManage(user);
    return this.prisma.examSession.findMany({
      where: { startsAt: { gte: from }, timetable: { status: 'PUBLISHED' }, ...(manage ? {} : { invigilators: { some: { userId: user.id } } }) },
      orderBy: { startsAt: 'asc' },
      take: 100,
      select: { id: true, startsAt: true, durationMinutes: true, registerClosedAt: true, venue: { select: { name: true } }, offering: { select: { course: { select: { code: true, title: true } } } }, _count: { select: { seats: true, attendance: true } } },
    });
  }

  /** The register: every seated candidate with eligibility, fee clearance, unpaid compulsory dues and attendance. */
  async register(user: AuthUser, sessionId: string) {
    await this.assertAccess(user, sessionId);
    const s = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true, startsAt: true, durationMinutes: true, registerNote: true, registerClosedAt: true, venue: { select: { name: true } },
        offering: { select: { id: true, semesterId: true, course: { select: { code: true, title: true } } } },
        seats: { orderBy: { seatNumber: 'asc' }, select: { seatNumber: true, student: { select: { id: true, firstName: true, lastName: true, indexNumber: true } } } },
        attendance: { select: { studentId: true, status: true, markedAt: true, note: true } },
      },
    });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Paper not found.' });
    const ids = s.seats.map((x) => x.student.id);
    const [eligibility, clearance, unpaid] = await Promise.all([
      this.prisma.examEligibility.findMany({ where: { offeringId: s.offering.id, studentId: { in: ids } }, select: { studentId: true, publishedStatus: true, overrideStatus: true, status: true } }),
      this.prisma.financialClearance.findMany({ where: { semesterId: s.offering.semesterId, studentId: { in: ids } }, select: { studentId: true, cleared: true } }),
      this.unpaidDues(ids, s.offering.semesterId),
    ]);
    const el = new Map(eligibility.map((e) => [e.studentId, e.overrideStatus ?? e.publishedStatus ?? e.status]));
    const cl = new Map(clearance.map((c) => [c.studentId, c.cleared]));
    const att = new Map(s.attendance.map((a) => [a.studentId, a]));
    return {
      ...s,
      seats: undefined,
      attendance: undefined,
      rows: s.seats.map((x) => ({
        seatNumber: x.seatNumber, student: x.student,
        eligible: el.get(x.student.id) ?? null, feeCleared: cl.get(x.student.id) ?? false,
        unpaidDues: unpaid.get(x.student.id) ?? [],
        attendance: att.get(x.student.id) ?? null,
      })),
    };
  }

  /** Associations whose compulsory dues each student has not paid this semester, where the Head of Department shows it. Never blocking. */
  private async unpaidDues(studentIds: string[], semesterId: string) {
    const out = new Map<string, string[]>();
    if (!studentIds.length) return out;
    const [levies, students] = await Promise.all([
      this.prisma.duesLevy.findMany({ where: { semesterId }, select: { id: true, association: { select: { code: true, departments: { select: { departmentId: true } } } }, payments: { where: { voidedAt: null, studentId: { in: studentIds } }, select: { studentId: true } } } }),
      this.prisma.user.findMany({ where: { id: { in: studentIds } }, select: { id: true, studentProfile: { select: { programme: { select: { departmentId: true, department: { select: { showDuesOnRegister: true } } } } } } } }),
    ]);
    for (const st of students) {
      // Only departments whose Head has switched the marker on.
      if (!st.studentProfile?.programme.department.showDuesOnRegister) continue;
      const dept = st.studentProfile?.programme.departmentId;
      const owed = levies.filter((l) => l.association.departments.some((d) => d.departmentId === dept) && !l.payments.some((p) => p.studentId === st.id)).map((l) => l.association.code);
      if (owed.length) out.set(st.id, [...new Set(owed)]);
    }
    return out;
  }

  /** Heads of Department switch the unpaid-dues marker on or off for their department's students. Nothing is ever blocked. */
  async duesMarker(user: AuthUser) {
    const perms = await this.resolver.permissionsFor(user.id, user.activeRoleKey);
    if (!perms.has(PERMISSIONS.RESULTS_APPROVE_DEPARTMENT)) throw new ForbiddenException({ code: 'HOD_ONLY', message: 'Heads of Department set this for their department.' });
    return this.prisma.department.findMany({ where: { id: await this.scope.departmentFilter(user) }, orderBy: { name: 'asc' }, select: { id: true, name: true, showDuesOnRegister: true } });
  }

  async setDuesMarker(user: AuthUser, departmentId: string, on: boolean) {
    const perms = await this.resolver.permissionsFor(user.id, user.activeRoleKey);
    if (!perms.has(PERMISSIONS.RESULTS_APPROVE_DEPARTMENT)) throw new ForbiddenException({ code: 'HOD_ONLY', message: 'Heads of Department set this for their department.' });
    await this.scope.assertDepartment(user, departmentId);
    await this.prisma.department.update({ where: { id: departmentId }, data: { showDuesOnRegister: on } });
    await this.audit.record({ action: on ? 'exams.dues_marker_on' : 'exams.dues_marker_off', module: 'exams', targetType: 'Department', targetId: departmentId });
    return { showDuesOnRegister: on };
  }

  async mark(user: AuthUser, sessionId: string, dto: { studentId?: string; indexNumber?: string; status: 'PRESENT' | 'LATE' | 'ABSENT'; note?: string }) {
    await this.assertAccess(user, sessionId);
    const s = await this.prisma.examSession.findUniqueOrThrow({ where: { id: sessionId }, select: { registerClosedAt: true } });
    if (s.registerClosedAt) throw new ConflictException({ code: 'CLOSED', message: 'This register has been closed.' });
    const seat = await this.prisma.examSeat.findFirst({ where: { sessionId, ...(dto.studentId ? { studentId: dto.studentId } : { student: { indexNumber: dto.indexNumber?.toUpperCase() } }) }, select: { studentId: true, seatNumber: true, student: { select: { firstName: true, lastName: true } } } });
    if (!seat) throw new NotFoundException({ code: 'NOT_SEATED', message: 'That student is not on the list for this paper. Send them to the Exams Office.' });
    await this.prisma.examAttendance.upsert({
      where: { sessionId_studentId: { sessionId, studentId: seat.studentId } },
      create: { sessionId, studentId: seat.studentId, status: dto.status, markedById: user.id, note: dto.note },
      update: { status: dto.status, markedById: user.id, markedAt: new Date(), note: dto.note },
    });
    return { seatNumber: seat.seatNumber, name: `${seat.student.firstName} ${seat.student.lastName}`, status: dto.status };
  }

  /** Closes the register: anyone not marked is recorded absent. */
  async close(user: AuthUser, sessionId: string, note?: string) {
    await this.assertAccess(user, sessionId);
    const [seats, marked] = await Promise.all([
      this.prisma.examSeat.findMany({ where: { sessionId }, select: { studentId: true } }),
      this.prisma.examAttendance.findMany({ where: { sessionId }, select: { studentId: true } }),
    ]);
    const done = new Set(marked.map((m) => m.studentId));
    const absent = seats.filter((x) => !done.has(x.studentId));
    await this.prisma.$transaction([
      this.prisma.examAttendance.createMany({ data: absent.map((x) => ({ sessionId, studentId: x.studentId, status: 'ABSENT' as const, markedById: user.id })) }),
      this.prisma.examSession.update({ where: { id: sessionId }, data: { registerClosedAt: new Date(), registerClosedById: user.id, registerNote: note || null } }),
    ]);
    await this.audit.record({ action: 'exams.register_closed', module: 'exams', targetType: 'ExamSession', targetId: sessionId, metadata: { candidates: seats.length, absent: absent.length, note } });
    return { candidates: seats.length, absent: absent.length };
  }
}
