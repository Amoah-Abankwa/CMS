import { HostelFeesService } from './hostel-fees.service';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { allocateBeds, formatCedis, priorityGroup, type Applicant, type Gender, mutualRoommates } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JobsService, QUEUES } from '../../core/jobs/jobs.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { SemestersService } from '../academics/semesters.service';
import { HOLDING } from './hostels.service';
import { ApplicationsQuery, RoundDto } from './dto/accommodation.dto';

export const toGender = (g: string | null | undefined): Gender | null => (g === 'Female' ? 'FEMALE' : g === 'Male' ? 'MALE' : null);
const fmtDate = (d: Date) => d.toLocaleString('en-GB', { timeZone: 'Africa/Accra', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const ALLOCATION_SELECT = {
  id: true, status: true, source: true, preferenceRank: true, offeredAt: true, acceptBy: true, respondedAt: true, cancelReason: true,
  student: { select: { id: true, indexNumber: true, firstName: true, lastName: true, studentProfile: { select: { gender: true, currentLevel: true } } } },
  room: { select: { id: true, number: true, roomType: true, pricePerSemester: true, capacity: true, hostel: { select: { id: true, name: true } } } },
} as const;

/**
 * University hostel allocation. Running allocation creates PROVISIONAL places visible only to the
 * Hostel Office; publishing turns them into offers students must accept in time.
 */
@Injectable()
export class AllocationService implements OnModuleInit {
  private readonly logger = new Logger(AllocationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly semesters: SemestersService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly hostelFees: HostelFeesService,
  ) {}

  async onModuleInit() {
    await this.jobs.work(QUEUES.ACCOMMODATION_EXPIRE_OFFERS, () => this.expireOffers());
    await this.jobs.schedule(QUEUES.ACCOMMODATION_EXPIRE_OFFERS, '*/15 * * * *');
  }

  async round(semesterId?: string) {
    const semester = await this.semesters.resolve(semesterId);
    const round = await this.prisma.accommodationRound.findUnique({ where: { semesterId: semester.id } });
    const now = new Date();
    return { semester, round, open: !!round && round.opensAt <= now && now <= round.closesAt };
  }

  async saveRound(dto: RoundDto) {
    const semester = await this.semesters.resolve(dto.semesterId);
    const opensAt = new Date(dto.opensAt);
    const closesAt = new Date(dto.closesAt);
    if (closesAt <= opensAt) throw new BadRequestException({ code: 'DATES', message: 'Applications must close after they open.' });
    const round = await this.prisma.accommodationRound.upsert({
      where: { semesterId: semester.id },
      create: { semesterId: semester.id, opensAt, closesAt, acceptanceDays: dto.acceptanceDays },
      update: { opensAt, closesAt, acceptanceDays: dto.acceptanceDays },
    });
    await this.audit.record({ action: 'hostels.round_saved', module: 'accommodation', metadata: { semester: semester.label, opensAt, closesAt, acceptanceDays: dto.acceptanceDays } });
    return round;
  }

  async applications(q: ApplicationsQuery) {
    const semester = await this.semesters.resolve(q.semesterId);
    const where = {
      semesterId: semester.id,
      ...(q.status === 'SPECIAL_NEEDS' ? { specialNeeds: { not: null } } : q.status ? { status: q.status as 'SUBMITTED' } : {}),
      ...(q.search
        ? { student: { OR: [{ indexNumber: { contains: q.search, mode: 'insensitive' as const } }, { firstName: { contains: q.search, mode: 'insensitive' as const } }, { lastName: { contains: q.search, mode: 'insensitive' as const } }] } }
        : {}),
    };
    const [rows, total, counts, hostels] = await Promise.all([
      this.prisma.hostelApplication.findMany({
        where,
        orderBy: { submittedAt: 'asc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          student: {
            select: {
              id: true, indexNumber: true, firstName: true, lastName: true,
              studentProfile: { select: { gender: true, currentLevel: true, programme: { select: { name: true, durationYears: true } } } },
            },
          },
        },
      }),
      this.prisma.hostelApplication.count({ where }),
      this.prisma.hostelApplication.groupBy({ by: ['status'], where: { semesterId: semester.id }, _count: { _all: true } }),
      this.prisma.hostel.findMany({ where: { kind: 'UNIVERSITY' }, select: { id: true, name: true } }),
    ]);
    const hostelName = new Map(hostels.map((h) => [h.id, h.name]));
    return {
      semester,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      total,
      page: q.page,
      pageSize: q.pageSize,
      items: rows.map((a) => ({
        ...a,
        preferences: (a.preferences as Array<{ hostelId: string; roomType: string | null }>).map((p) => ({ ...p, hostelName: hostelName.get(p.hostelId) ?? 'Unknown hostel' })),
        group: priorityGroup({ specialNeedsApproved: a.specialNeedsApproved, level: a.student.studentProfile?.currentLevel ?? 100, finalLevel: (a.student.studentProfile?.programme.durationYears ?? 4) * 100 }),
      })),
    };
  }

  async setSpecialNeeds(id: string, approved: boolean) {
    const app = await this.prisma.hostelApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Application not found.' });
    if (!app.specialNeeds) throw new BadRequestException({ code: 'NO_NEED', message: 'This student did not describe a special need.' });
    await this.prisma.hostelApplication.update({ where: { id }, data: { specialNeedsApproved: approved } });
    await this.audit.record({ action: approved ? 'hostels.special_needs_approved' : 'hostels.special_needs_declined', module: 'accommodation', targetType: 'HostelApplication', targetId: id });
    return { ok: true };
  }

  /** Replaces any unpublished provisional places with a fresh run over everyone still waiting. */
  async run(user: AuthUser, semesterId?: string) {
    const semester = await this.semesters.resolve(semesterId);
    await this.prisma.roomAllocation.deleteMany({ where: { semesterId: semester.id, status: 'PROVISIONAL' } });

    const [apps, rooms] = await Promise.all([
      this.prisma.hostelApplication.findMany({
        where: { semesterId: semester.id, status: { in: ['SUBMITTED', 'UNPLACED'] }, student: { status: 'ACTIVE', roomAllocations: { none: { semesterId: semester.id, status: { in: ['OFFERED', 'ACCEPTED'] } } } } },
        include: { student: { select: { indexNumber: true, studentProfile: { select: { gender: true, currentLevel: true, programme: { select: { durationYears: true } } } } } } },
      }),
      this.prisma.room.findMany({
        where: { isActive: true, hostel: { kind: 'UNIVERSITY', isActive: true, gender: { in: ['MALE', 'FEMALE'] } } },
        select: {
          id: true, number: true, capacity: true, roomType: true,
          hostel: { select: { id: true, gender: true } },
          _count: { select: { allocations: { where: { semesterId: semester.id, status: { in: [...HOLDING] } } } } },
        },
      }),
    ]);

    const applicants: Applicant[] = apps.map((a) => ({
      applicationId: a.id,
      studentId: a.studentId,
      gender: toGender(a.student.studentProfile?.gender),
      group: priorityGroup({ specialNeedsApproved: a.specialNeedsApproved, level: a.student.studentProfile?.currentLevel ?? 100, finalLevel: (a.student.studentProfile?.programme.durationYears ?? 4) * 100 }),
      submittedAt: a.submittedAt,
      preferences: a.preferences as Applicant['preferences'],
      acceptAny: a.acceptAny,
    }));
    // Roommate requests count when both named each other and are the same gender.
    const byIndex = new Map(apps.map((a) => [a.student.indexNumber, a.studentId]));
    const mates = mutualRoommates(applicants.map((x, i) => ({ studentId: x.studentId, gender: x.gender, wantsStudentId: apps[i].roommateIndex ? byIndex.get(apps[i].roommateIndex) ?? null : null })));
    for (const x of applicants) x.roommateStudentId = mates.get(x.studentId) ?? null;
    const { placements, unplaced } = allocateBeds(
      applicants,
      rooms.map((r) => ({ roomId: r.id, hostelId: r.hostel.id, hostelGender: r.hostel.gender as Gender, roomType: r.roomType, label: r.number, capacity: r.capacity, occupied: r._count.allocations })),
    );

    await this.prisma.$transaction([
      this.prisma.roomAllocation.createMany({
        data: placements.map((p) => ({ semesterId: semester.id, studentId: p.studentId, roomId: p.roomId, status: 'PROVISIONAL' as const, source: 'AUTO' as const, preferenceRank: p.preferenceRank, createdById: user.id })),
      }),
      this.prisma.accommodationRound.updateMany({ where: { semesterId: semester.id }, data: { lastRunAt: new Date() } }),
    ]);
    await this.audit.record({ action: 'hostels.allocation_run', module: 'accommodation', metadata: { semester: semester.label, applicants: applicants.length, placed: placements.length, unplaced: unplaced.length } });
    return {
      applicants: applicants.length,
      placed: placements.length,
      firstChoice: placements.filter((p) => p.preferenceRank === 1).length,
      anyHostel: placements.filter((p) => p.preferenceRank === null).length,
      unplaced: { noBed: unplaced.filter((u) => u.reason === 'NO_BED').length, noGender: unplaced.filter((u) => u.reason === 'NO_GENDER').length },
    };
  }

  /** Allocations for the semester, provisional first. */
  async allocations(semesterId?: string, status?: string) {
    const semester = await this.semesters.resolve(semesterId);
    const items = await this.prisma.roomAllocation.findMany({
      where: { semesterId: semester.id, ...(status ? { status: status as 'OFFERED' } : { status: { in: [...HOLDING] } }) },
      orderBy: [{ status: 'asc' }, { room: { hostel: { name: 'asc' } } }, { room: { number: 'asc' } }],
      select: ALLOCATION_SELECT,
    });
    return { semester, items };
  }

  /** Turns provisional places into offers, and tells students still waiting that they are on the waiting list. */
  async publish(user: AuthUser, semesterId?: string) {
    const { semester, round } = await this.round(semesterId);
    if (!round) throw new BadRequestException({ code: 'NO_ROUND', message: 'Set the application window for this semester first.' });
    const provisional = await this.prisma.roomAllocation.findMany({ where: { semesterId: semester.id, status: 'PROVISIONAL' }, select: ALLOCATION_SELECT });
    if (!provisional.length) throw new ConflictException({ code: 'NOTHING_TO_PUBLISH', message: 'Run allocation first. There are no provisional places to offer.' });

    const now = new Date();
    const acceptBy = new Date(now.getTime() + round.acceptanceDays * 86_400_000);
    const placedStudents = provisional.map((p) => p.student.id);
    const waiting = await this.prisma.hostelApplication.findMany({
      where: { semesterId: semester.id, status: { in: ['SUBMITTED', 'UNPLACED'] }, studentId: { notIn: placedStudents } },
      select: { studentId: true, status: true },
    });

    await this.prisma.$transaction([
      this.prisma.roomAllocation.updateMany({ where: { id: { in: provisional.map((p) => p.id) } }, data: { status: 'OFFERED', offeredAt: now, acceptBy } }),
      this.prisma.hostelApplication.updateMany({ where: { semesterId: semester.id, studentId: { in: placedStudents } }, data: { status: 'ALLOCATED' } }),
      this.prisma.hostelApplication.updateMany({ where: { semesterId: semester.id, status: 'SUBMITTED', studentId: { notIn: placedStudents } }, data: { status: 'UNPLACED' } }),
      this.prisma.accommodationRound.update({ where: { semesterId: semester.id }, data: { lastPublishedAt: now } }),
    ]);

    await this.notifications.notify({
      eventKey: EVENT_KEYS.HOSTEL_OFFERED,
      recipients: provisional.map((p) => ({
        userId: p.student.id,
        vars: { hostel: p.room.hostel.name, room: p.room.number, roomType: p.room.roomType, price: formatCedis(p.room.pricePerSemester) },
      })),
      channels: ['IN_APP', 'EMAIL', 'SMS'],
      sharedVars: { semesterLabel: semester.label, acceptBy: fmtDate(acceptBy) },
      link: '/accommodation',
    });
    // Only tell students who are newly on the waiting list; those told in an earlier round are not told again.
    const newlyWaiting = waiting.filter((w) => w.status === 'SUBMITTED');
    await this.notifications.notify({
      eventKey: EVENT_KEYS.HOSTEL_UNPLACED,
      recipients: newlyWaiting.map((w) => ({ userId: w.studentId })),
      channels: ['IN_APP', 'EMAIL', 'SMS'],
      sharedVars: { semesterLabel: semester.label },
      link: '/accommodation',
    });
    await this.audit.record({ action: 'hostels.allocation_published', module: 'accommodation', metadata: { semester: semester.label, offered: provisional.length, waiting: waiting.length } });
    return { offered: provisional.length, waiting: waiting.length, acceptBy };
  }

  /** The Hostel Office places a student directly, e.g. a late application or a medical case. */
  async manual(user: AuthUser, semesterId: string | undefined, indexNumber: string, roomId: string) {
    const { semester, round } = await this.round(semesterId);
    const student = await this.prisma.user.findUnique({ where: { indexNumber }, select: { id: true, type: true, status: true, studentProfile: { select: { gender: true } } } });
    if (!student || student.type !== 'STUDENT' || student.status !== 'ACTIVE') throw new NotFoundException({ code: 'NOT_FOUND', message: 'No active student has that index number.' });
    await this.assertNoPlace(student.id, semester.id);
    const room = await this.freeRoom(roomId, semester.id, toGender(student.studentProfile?.gender));
    const now = new Date();
    const acceptBy = new Date(now.getTime() + (round?.acceptanceDays ?? 5) * 86_400_000);
    const allocation = await this.prisma.roomAllocation.create({
      data: { semesterId: semester.id, studentId: student.id, roomId, status: 'OFFERED', source: 'MANUAL', offeredAt: now, acceptBy, createdById: user.id },
      select: ALLOCATION_SELECT,
    });
    await this.prisma.hostelApplication.updateMany({ where: { semesterId: semester.id, studentId: student.id }, data: { status: 'ALLOCATED' } });
    await this.audit.record({ action: 'hostels.manual_allocation', module: 'accommodation', targetType: 'User', targetId: student.id, after: { room: `${room.hostel.name} ${room.number}` } });
    await this.notifications.notify({
      eventKey: EVENT_KEYS.HOSTEL_OFFERED,
      recipients: [{ userId: student.id }],
      channels: ['IN_APP', 'EMAIL', 'SMS'],
      sharedVars: { semesterLabel: semester.label, acceptBy: fmtDate(acceptBy), hostel: room.hostel.name, room: room.number, roomType: room.roomType, price: formatCedis(room.pricePerSemester) },
      link: '/accommodation',
    });
    return allocation;
  }

  async move(user: AuthUser, id: string, roomId: string) {
    const a = await this.prisma.roomAllocation.findUnique({ where: { id }, select: { ...ALLOCATION_SELECT, semesterId: true } });
    if (!a || !HOLDING.includes(a.status as (typeof HOLDING)[number])) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Active allocation not found.' });
    if (a.room.id === roomId) throw new BadRequestException({ code: 'SAME_ROOM', message: 'The student is already in that room.' });
    const room = await this.freeRoom(roomId, a.semesterId, toGender(a.student.studentProfile?.gender));
    await this.prisma.roomAllocation.update({ where: { id }, data: { roomId } });
    await this.hostelFees.syncAllocation(id, user.id);
    await this.audit.record({ action: 'hostels.allocation_moved', module: 'accommodation', targetType: 'RoomAllocation', targetId: id, before: { room: `${a.room.hostel.name} ${a.room.number}` }, after: { room: `${room.hostel.name} ${room.number}` } });
    if (a.status !== 'PROVISIONAL') {
      await this.notifications.notify({
        eventKey: EVENT_KEYS.HOSTEL_ALLOCATION_CHANGED,
        recipients: [{ userId: a.student.id }],
        channels: ['IN_APP', 'EMAIL', 'SMS'],
        sharedVars: { change: `Your hostel room has moved from ${a.room.hostel.name} ${a.room.number} to ${room.hostel.name} ${room.number}.` },
        link: '/accommodation',
      });
    }
    return { ok: true };
  }

  async cancel(user: AuthUser, id: string, reason: string) {
    const a = await this.prisma.roomAllocation.findUnique({ where: { id }, select: { ...ALLOCATION_SELECT, semesterId: true } });
    if (!a || !HOLDING.includes(a.status as (typeof HOLDING)[number])) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Active allocation not found.' });
    await this.prisma.roomAllocation.update({ where: { id }, data: { status: 'CANCELLED', cancelReason: reason.trim(), respondedAt: new Date() } });
    await this.hostelFees.syncAllocation(id, user.id);
    await this.prisma.hostelApplication.updateMany({ where: { semesterId: a.semesterId, studentId: a.student.id, status: 'ALLOCATED' }, data: { status: 'UNPLACED' } });
    await this.audit.record({ action: 'hostels.allocation_cancelled', module: 'accommodation', targetType: 'RoomAllocation', targetId: id, metadata: { reason, room: `${a.room.hostel.name} ${a.room.number}` } });
    if (a.status !== 'PROVISIONAL') {
      await this.notifications.notify({
        eventKey: EVENT_KEYS.HOSTEL_ALLOCATION_CHANGED,
        recipients: [{ userId: a.student.id }],
        channels: ['IN_APP', 'EMAIL', 'SMS'],
        sharedVars: { change: `Your place in ${a.room.hostel.name} ${a.room.number} has been cancelled by the Hostel Office. Reason: ${reason}` },
        link: '/accommodation',
      });
    }
    return { ok: true };
  }

  /** Runs every 15 minutes: offers not accepted in time are released. */
  async expireOffers() {
    const due = await this.prisma.roomAllocation.findMany({ where: { status: 'OFFERED', acceptBy: { lt: new Date() } }, select: { ...ALLOCATION_SELECT, semesterId: true } });
    for (const a of due) {
      try {
        await this.prisma.roomAllocation.update({ where: { id: a.id }, data: { status: 'EXPIRED', respondedAt: new Date() } });
        await this.prisma.hostelApplication.updateMany({ where: { semesterId: a.semesterId, studentId: a.student.id }, data: { status: 'WITHDRAWN' } });
        await this.notifications.notify({
          eventKey: EVENT_KEYS.HOSTEL_OFFER_EXPIRED,
          recipients: [{ userId: a.student.id }],
          channels: ['IN_APP', 'EMAIL', 'SMS'],
          sharedVars: { hostel: a.room.hostel.name, room: a.room.number, acceptBy: a.acceptBy ? fmtDate(a.acceptBy) : 'the deadline' },
          link: '/accommodation',
        });
      } catch (err) {
        this.logger.error(`Could not expire allocation ${a.id}: ${(err as Error).message}`);
      }
    }
  }

  async assertNoPlace(studentId: string, semesterId: string) {
    const existing = await this.prisma.roomAllocation.findFirst({ where: { studentId, semesterId, status: { in: [...HOLDING] } }, select: { room: { select: { number: true, hostel: { select: { name: true } } } } } });
    if (existing) throw new ConflictException({ code: 'ALREADY_PLACED', message: `This student already has ${existing.room.hostel.name} ${existing.room.number}. Move or cancel that place instead.` });
  }

  private async freeRoom(roomId: string, semesterId: string, gender: Gender | null) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true, number: true, capacity: true, isActive: true, roomType: true, pricePerSemester: true,
        hostel: { select: { name: true, gender: true, kind: true } },
        _count: { select: { allocations: { where: { semesterId, status: { in: [...HOLDING] } } } } },
      },
    });
    if (!room || !room.isActive || room.hostel.kind !== 'UNIVERSITY') throw new NotFoundException({ code: 'ROOM_INVALID', message: 'Choose an open room in a university hostel.' });
    if (!gender) throw new BadRequestException({ code: 'NO_GENDER', message: "The student's record has no gender, so a single-gender hostel cannot be chosen. Ask the Registry to update it." });
    if (room.hostel.gender !== gender) throw new BadRequestException({ code: 'WRONG_HOSTEL', message: `${room.hostel.name} is not for ${gender === 'FEMALE' ? 'female' : 'male'} students.` });
    if (room._count.allocations >= room.capacity) throw new ConflictException({ code: 'ROOM_FULL', message: `${room.hostel.name} ${room.number} is full.` });
    return room;
  }
}
