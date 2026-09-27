import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import { devotionStatusAt, devotionTimes, serviceDates } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JobsService, QUEUES } from '../../core/jobs/jobs.service';
import { loadEnv } from '../../core/config/env';
import { Prisma } from '../../generated/prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { SemestersService } from '../academics/semesters.service';
import { AttendanceSummaryService } from '../attendance/attendance-summary.service';
import { codeAt, codeMatches, currentStep, secondsLeft } from '../attendance/check-in-code';
import { DevotionPolicyService } from './devotion-policy.service';
import { AddServiceDto, RecordsQuery } from './dto/devotion.dto';

const fmtTime = (d: Date) => d.toLocaleTimeString('en-GB', { timeZone: 'Africa/Accra', hour: '2-digit', minute: '2-digit' });

/**
 * Morning devotion services: the semester schedule, the projector check-in code, door entry by ushers,
 * corrections, and closing a service (everyone expected who did not arrive becomes absent or excused).
 * Expected students are those with an approved course registration in the service's semester.
 */
@Injectable()
export class DevotionServicesService implements OnModuleInit {
  private readonly logger = new Logger(DevotionServicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly semesters: SemestersService,
    private readonly policy: DevotionPolicyService,
    private readonly attendance: AttendanceSummaryService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    await this.jobs.work(QUEUES.DEVOTION_CLOSE_SERVICES, () => this.closeFinished());
    await this.jobs.schedule(QUEUES.DEVOTION_CLOSE_SERVICES, '*/5 * * * *');
  }

  expectedWhere(semesterId: string): Prisma.UserWhereInput {
    return { type: 'STUDENT', status: 'ACTIVE', registrations: { some: { semesterId, status: 'APPROVED' } } };
  }

  async list(semesterId?: string) {
    const semester = await this.semesters.resolve(semesterId);
    const [services, expected] = await Promise.all([
      this.prisma.devotionService.findMany({
        where: { semesterId: semester.id },
        orderBy: { date: 'asc' },
        select: {
          id: true, date: true, opensAt: true, startsAt: true, lateFrom: true, endsAt: true, theme: true, speaker: true, cancelledAt: true, cancelReason: true, closedAt: true,
          records: { select: { status: true } },
        },
      }),
      this.prisma.user.count({ where: this.expectedWhere(semester.id) }),
    ]);
    const now = new Date();
    return {
      semester,
      expected,
      items: services.map(({ records, ...s }) => ({
        ...s,
        live: !s.cancelledAt && !s.closedAt && s.opensAt <= now && now < s.endsAt,
        counts: {
          early: records.filter((r) => r.status === 'EARLY').length,
          late: records.filter((r) => r.status === 'LATE').length,
          absent: records.filter((r) => r.status === 'ABSENT').length,
          excused: records.filter((r) => r.status === 'EXCUSED').length,
        },
      })),
    };
  }

  /** Creates a service for every devotion day in the semester that does not have one yet. */
  async generate(user: AuthUser, semesterId?: string) {
    const semester = await this.semesters.resolve(semesterId);
    const policy = await this.policy.get();
    const dates = serviceDates(new Date(semester.startDate), new Date(semester.endDate), policy.days);
    const existing = new Set((await this.prisma.devotionService.findMany({ where: { date: { in: dates.map((d) => new Date(`${d}T00:00:00Z`)) } }, select: { date: true } })).map((s) => s.date.toISOString().slice(0, 10)));
    const toCreate = dates.filter((d) => !existing.has(d));
    await this.prisma.devotionService.createMany({
      data: toCreate.map((d) => ({ date: new Date(`${d}T00:00:00Z`), semesterId: semester.id, ...devotionTimes(d, policy), checkInSecret: randomBytes(32).toString('base64url'), createdById: user.id })),
      skipDuplicates: true,
    });
    await this.audit.record({ action: 'devotion.services_generated', module: 'devotion', metadata: { semester: semester.label, created: toCreate.length } });
    return { created: toCreate.length, alreadyScheduled: dates.length - toCreate.length };
  }

  /** An extra service outside the usual days, e.g. a special week of prayer. */
  async add(user: AuthUser, dto: AddServiceDto) {
    const date = dto.date.slice(0, 10);
    const day = new Date(`${date}T00:00:00Z`);
    const semester = await this.prisma.semester.findFirst({ where: { startDate: { lte: day }, endDate: { gte: day } } });
    if (!semester) throw new BadRequestException({ code: 'OUTSIDE_SEMESTER', message: 'That date is not within any semester.' });
    const policy = await this.policy.get();
    try {
      const s = await this.prisma.devotionService.create({
        data: { date: day, semesterId: semester.id, ...devotionTimes(date, policy), theme: dto.theme?.trim() || null, speaker: dto.speaker?.trim() || null, checkInSecret: randomBytes(32).toString('base64url'), createdById: user.id },
      });
      await this.audit.record({ action: 'devotion.service_added', module: 'devotion', targetType: 'DevotionService', targetId: s.id, metadata: { date } });
      return s;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException({ code: 'EXISTS', message: 'There is already a service on that date.' });
      throw err;
    }
  }

  async update(id: string, theme?: string, speaker?: string) {
    await this.load(id);
    return this.prisma.devotionService.update({ where: { id }, data: { theme: theme?.trim() || null, speaker: speaker?.trim() || null } });
  }

  async cancel(id: string, reason: string) {
    const s = await this.load(id);
    if (s.closedAt) throw new ConflictException({ code: 'CLOSED', message: 'This service has already been recorded and closed.' });
    const records = await this.prisma.devotionRecord.count({ where: { serviceId: id } });
    if (records) throw new ConflictException({ code: 'HAS_RECORDS', message: 'Students have already checked in to this service. It cannot be cancelled.' });
    await this.prisma.devotionService.update({ where: { id }, data: { cancelledAt: new Date(), cancelReason: reason.trim(), checkInSecret: null } });
    await this.audit.record({ action: 'devotion.service_cancelled', module: 'devotion', targetType: 'DevotionService', targetId: id, metadata: { reason } });
  }

  /** The projector view: rotating code, QR code and live counts. */
  async screen(id: string) {
    const s = await this.load(id);
    const now = new Date();
    const [early, late, expected] = await Promise.all([
      this.prisma.devotionRecord.count({ where: { serviceId: id, status: 'EARLY' } }),
      this.prisma.devotionRecord.count({ where: { serviceId: id, status: 'LATE' } }),
      this.prisma.user.count({ where: this.expectedWhere(s.semesterId) }),
    ]);
    const base = {
      date: s.date, opensAt: s.opensAt, startsAt: s.startsAt, lateFrom: s.lateFrom, endsAt: s.endsAt, theme: s.theme, speaker: s.speaker,
      early, late, expected,
      phase: s.cancelledAt ? 'CANCELLED' : s.closedAt || now >= s.endsAt ? 'ENDED' : now < s.opensAt ? 'NOT_OPEN' : now < s.lateFrom ? 'EARLY' : 'LATE',
    };
    if (base.phase !== 'EARLY' && base.phase !== 'LATE') return { ...base, code: null };
    const code = codeAt(s.checkInSecret!, currentStep());
    return {
      ...base,
      code,
      secondsLeft: secondsLeft(),
      qrDataUrl: await QRCode.toDataURL(`${loadEnv().WEB_ORIGIN}/devotion?code=${code}`, { margin: 1, width: 320 }),
    };
  }

  /** Ushers type or scan an index number as the student walks in. The time decides early or late. */
  async door(user: AuthUser, id: string, indexNumber: string) {
    const s = await this.load(id);
    const now = new Date();
    const outcome = this.assertOpen(s, now);
    const student = await this.prisma.user.findFirst({
      where: { indexNumber, ...this.expectedWhere(s.semesterId) },
      select: { id: true, indexNumber: true, firstName: true, lastName: true },
    });
    if (!student) throw new NotFoundException({ code: 'NOT_EXPECTED', message: `${indexNumber} is not an active student this semester. Check the number.` });
    const existing = await this.prisma.devotionRecord.findUnique({ where: { serviceId_studentId: { serviceId: id, studentId: student.id } } });
    if (existing) {
      return { student, status: existing.status, arrivedAt: existing.arrivedAt, alreadyRecorded: true };
    }
    await this.prisma.devotionRecord.create({ data: { serviceId: id, studentId: student.id, status: outcome, source: 'DOOR', arrivedAt: now, recordedById: user.id } });
    return { student, status: outcome, arrivedAt: now, alreadyRecorded: false };
  }

  /** Student self check-in with the code on the screen. */
  async checkIn(user: AuthUser, code: string) {
    if (user.type !== 'STUDENT') throw new ForbiddenException({ code: 'STUDENTS_ONLY', message: 'Devotion check-in is for students.' });
    const now = new Date();
    const live = await this.prisma.devotionService.findMany({
      where: { cancelledAt: null, closedAt: null, opensAt: { lte: now }, endsAt: { gt: now }, checkInSecret: { not: null } },
    });
    const service = live.find((s) => codeMatches(s.checkInSecret!, code));
    if (!service) {
      await this.audit.record({ action: 'devotion.checkin_failed', module: 'devotion', result: 'FAILURE', metadata: { liveServices: live.length } });
      throw new BadRequestException({
        code: 'CODE_INVALID',
        message: live.length ? 'That code is not valid or has changed. Enter the code on the screen now.' : 'Devotion check-in is not open right now.',
      });
    }
    const expected = await this.prisma.user.count({ where: { id: user.id, ...this.expectedWhere(service.semesterId) } });
    if (!expected) throw new ForbiddenException({ code: 'NOT_EXPECTED', message: 'Only students with approved courses this semester are recorded for devotion.' });

    const status = this.assertOpen(service, now);
    const existing = await this.prisma.devotionRecord.findUnique({ where: { serviceId_studentId: { serviceId: service.id, studentId: user.id } } });
    if (existing) return { status: existing.status, arrivedAt: existing.arrivedAt, alreadyRecorded: true };
    await this.prisma.devotionRecord.create({ data: { serviceId: service.id, studentId: user.id, status, source: 'SELF_CHECK_IN', arrivedAt: now } });
    await this.audit.record({ action: 'devotion.checked_in', module: 'devotion', targetType: 'DevotionService', targetId: service.id, metadata: { status } });
    return { status, arrivedAt: now, alreadyRecorded: false };
  }

  /** Everyone expected, with their status for this service. */
  async records(id: string, q: RecordsQuery) {
    const s = await this.load(id);
    const where: Prisma.UserWhereInput = {
      ...this.expectedWhere(s.semesterId),
      ...(q.status === 'NONE' ? { devotion: { none: { serviceId: id } } } : q.status ? { devotion: { some: { serviceId: id, status: q.status as 'EARLY' } } } : {}),
      ...(q.search
        ? { OR: [{ indexNumber: { contains: q.search, mode: 'insensitive' as const } }, { firstName: { contains: q.search, mode: 'insensitive' as const } }, { lastName: { contains: q.search, mode: 'insensitive' as const } }] }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { indexNumber: 'asc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true, indexNumber: true, firstName: true, lastName: true,
          devotion: { where: { serviceId: id }, select: { status: true, source: true, arrivedAt: true, note: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      service: { id: s.id, date: s.date, opensAt: s.opensAt, startsAt: s.startsAt, lateFrom: s.lateFrom, endsAt: s.endsAt, theme: s.theme, speaker: s.speaker, closedAt: s.closedAt, cancelledAt: s.cancelledAt },
      items: rows.map(({ devotion, ...r }) => ({ ...r, record: devotion[0] ?? null })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  /** Fixes a mistake, e.g. a student recorded absent who was at the door. Always needs a reason. */
  async correct(user: AuthUser, id: string, studentId: string, status: 'EARLY' | 'LATE' | 'ABSENT', reason: string) {
    const s = await this.load(id);
    if (s.cancelledAt) throw new ConflictException({ code: 'CANCELLED', message: 'This service was cancelled.' });
    if (new Date() < s.opensAt) throw new BadRequestException({ code: 'NOT_OPEN', message: 'This service has not started yet.' });
    const expected = await this.prisma.user.count({ where: { id: studentId, ...this.expectedWhere(s.semesterId) } });
    if (!expected) throw new NotFoundException({ code: 'NOT_EXPECTED', message: 'That student is not expected at devotion this semester.' });
    const before = await this.prisma.devotionRecord.findUnique({ where: { serviceId_studentId: { serviceId: id, studentId } } });
    const data = { status, source: 'CORRECTION' as const, recordedById: user.id, note: reason.trim() };
    await this.prisma.devotionRecord.upsert({ where: { serviceId_studentId: { serviceId: id, studentId } }, create: { serviceId: id, studentId, ...data }, update: data });
    await this.audit.record({ action: 'devotion.record_corrected', module: 'devotion', targetType: 'User', targetId: studentId, before, after: { status, reason, service: s.date } });
    return { ok: true };
  }

  async close(user: AuthUser, id: string) {
    await this.finalise(id);
    await this.audit.record({ action: 'devotion.service_closed', module: 'devotion', targetType: 'DevotionService', targetId: id });
    return { ok: true };
  }

  /** Runs every 5 minutes: closes services that have ended. */
  async closeFinished() {
    const due = await this.prisma.devotionService.findMany({ where: { closedAt: null, cancelledAt: null, endsAt: { lte: new Date() } }, select: { id: true } });
    for (const s of due) {
      try {
        await this.finalise(s.id);
      } catch (err) {
        this.logger.error(`Could not close devotion ${s.id}: ${(err as Error).message}`);
      }
    }
  }

  /** Expected students with no record become absent, or excused if an excuse covers the day. */
  private async finalise(id: string) {
    const s = await this.load(id);
    if (s.cancelledAt) throw new ConflictException({ code: 'CANCELLED', message: 'This service was cancelled.' });
    if (s.closedAt) return;
    if (new Date() < s.lateFrom) throw new BadRequestException({ code: 'TOO_EARLY', message: 'A service can be closed once late arrivals have started.' });
    const missing = await this.prisma.user.findMany({ where: { ...this.expectedWhere(s.semesterId), devotion: { none: { serviceId: id } } }, select: { id: true } });
    const excused = await this.attendance.excusedOn(missing.map((m) => m.id), s.date);
    await this.prisma.$transaction([
      this.prisma.devotionRecord.createMany({
        data: missing.map((m) => ({ serviceId: id, studentId: m.id, status: excused.has(m.id) ? ('EXCUSED' as const) : ('ABSENT' as const), source: excused.has(m.id) ? ('EXCUSE' as const) : ('CLOSE' as const) })),
        skipDuplicates: true,
      }),
      this.prisma.devotionService.update({ where: { id }, data: { closedAt: new Date(), checkInSecret: null } }),
    ]);
  }

  private assertOpen(s: { opensAt: Date; lateFrom: Date; endsAt: Date; cancelledAt: Date | null; closedAt: Date | null }, now: Date): 'EARLY' | 'LATE' {
    if (s.cancelledAt) throw new ConflictException({ code: 'CANCELLED', message: 'This service was cancelled.' });
    const r = devotionStatusAt(s, now);
    if ('error' in r || s.closedAt) {
      const ended = s.closedAt || ('error' in r && r.error === 'ENDED');
      throw new BadRequestException({
        code: ended ? 'ENDED' : 'NOT_OPEN',
        message: ended ? `Devotion ended at ${fmtTime(s.endsAt)}. Arrivals after that are recorded as absent.` : `Check-in opens at ${fmtTime(s.opensAt)}.`,
      });
    }
    return r.status;
  }

  private async load(id: string) {
    const s = await this.prisma.devotionService.findUnique({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Devotion service not found.' });
    return s;
  }
}
