import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { academicYearProblem, semesterDatesProblem, termName } from '@anu/shared';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface SemesterWindow {
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
}

export function registrationOpen(s: SemesterWindow, now = new Date()) {
  return !!s.registrationOpensAt && !!s.registrationClosesAt && s.registrationOpensAt <= now && now <= s.registrationClosesAt;
}

export function semesterLabel(s: { number: number; academicYear: { label: string } }) {
  return `${s.academicYear.label} ${termName(s.number)}`;
}

const SELECT = {
  id: true, number: true, startDate: true, endDate: true, isCurrent: true,
  registrationOpensAt: true, registrationClosesAt: true, minCredits: true, maxCredits: true, summerKind: true,
  academicYear: { select: { id: true, label: true } },
} as const;

@Injectable()
export class SemestersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const rows = await this.prisma.semester.findMany({
      orderBy: [{ academicYear: { startDate: 'desc' } }, { number: 'desc' }],
      select: SELECT,
    });
    return rows.map((s) => ({ ...s, label: semesterLabel(s), registrationOpen: registrationOpen(s) }));
  }

  /** The semester marked current, or the one given. */
  async resolve(semesterId?: string) {
    const s = semesterId
      ? await this.prisma.semester.findUnique({ where: { id: semesterId }, select: SELECT })
      : await this.prisma.semester.findFirst({ where: { isCurrent: true }, select: SELECT });
    if (!s) throw new NotFoundException({ code: 'NO_SEMESTER', message: semesterId ? 'Semester not found.' : 'No semester is marked as current. Ask the Registry to set one.' });
    return { ...s, label: semesterLabel(s), registrationOpen: registrationOpen(s) };
  }

  async update(
    id: string,
    dto: { registrationOpensAt?: string | null; registrationClosesAt?: string | null; minCredits?: number; maxCredits?: number; isCurrent?: boolean; summerKind?: 'PROMOTIONAL' | 'UPGRADE' | null },
  ) {
    const before = await this.prisma.semester.findUnique({ where: { id }, select: SELECT });
    if (!before) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Semester not found.' });

    const opens = dto.registrationOpensAt === undefined ? before.registrationOpensAt : dto.registrationOpensAt ? new Date(dto.registrationOpensAt) : null;
    const closes = dto.registrationClosesAt === undefined ? before.registrationClosesAt : dto.registrationClosesAt ? new Date(dto.registrationClosesAt) : null;
    if (!!opens !== !!closes) throw new BadRequestException({ code: 'WINDOW_INCOMPLETE', message: 'Set both the opening and closing time, or clear both.' });
    if (opens && closes && closes <= opens) throw new BadRequestException({ code: 'WINDOW_ORDER', message: 'Registration must close after it opens.' });
    const min = dto.minCredits ?? before.minCredits;
    const max = dto.maxCredits ?? before.maxCredits;
    if (min > max) throw new BadRequestException({ code: 'CREDIT_LIMITS', message: 'Minimum credits cannot be more than the maximum.' });
    if (dto.summerKind && before.number !== 3) throw new BadRequestException({ code: 'NOT_SUMMER', message: 'Only a summer is promotional or upgrade.' });

    const after = await this.prisma.$transaction(async (tx) => {
      if (dto.isCurrent) {
        await tx.semester.updateMany({ where: { id: { not: id } }, data: { isCurrent: false } });
        // Its academic year becomes the current one too.
        await tx.academicYear.updateMany({ where: { id: { not: before.academicYear.id } }, data: { isCurrent: false } });
        await tx.academicYear.update({ where: { id: before.academicYear.id }, data: { isCurrent: true } });
      }
      return tx.semester.update({
        where: { id },
        data: { registrationOpensAt: opens, registrationClosesAt: closes, minCredits: min, maxCredits: max, ...(dto.isCurrent !== undefined ? { isCurrent: dto.isCurrent } : {}), ...(dto.summerKind !== undefined ? { summerKind: dto.summerKind } : {}) },
        select: SELECT,
      });
    });
    await this.audit.record({ action: 'semester.updated', module: 'academics', targetType: 'Semester', targetId: id, before, after });
    return { ...after, label: semesterLabel(after), registrationOpen: registrationOpen(after) };
  }

  // ----- Academic years and new semesters (the Registrar) -----

  async years() {
    return this.prisma.academicYear.findMany({
      orderBy: { startDate: 'desc' },
      select: { id: true, label: true, startDate: true, endDate: true, isCurrent: true, semesters: { orderBy: { number: 'asc' }, select: { id: true, number: true, startDate: true, endDate: true, isCurrent: true, summerKind: true } } },
    });
  }

  async createYear(dto: { label: string; startDate: string; endDate: string }) {
    const label = dto.label.trim();
    const problem = academicYearProblem(label, dto.startDate, dto.endDate);
    if (problem) throw new BadRequestException({ code: 'YEAR', message: problem });
    if (await this.prisma.academicYear.findUnique({ where: { label } })) throw new ConflictException({ code: 'EXISTS', message: `${label} already exists.` });
    const y = await this.prisma.academicYear.create({ data: { label, startDate: new Date(`${dto.startDate.slice(0, 10)}T00:00:00Z`), endDate: new Date(`${dto.endDate.slice(0, 10)}T00:00:00Z`), isCurrent: false } });
    await this.audit.record({ action: 'academics.year_created', module: 'academics', targetType: 'AcademicYear', targetId: y.id, after: { label, startDate: dto.startDate, endDate: dto.endDate } });
    return y;
  }

  async updateYear(id: string, dto: { startDate: string; endDate: string }) {
    const y = await this.prisma.academicYear.findUnique({ where: { id }, include: { semesters: true } });
    if (!y) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Academic year not found.' });
    const problem = academicYearProblem(y.label, dto.startDate, dto.endDate);
    if (problem) throw new BadRequestException({ code: 'YEAR', message: problem });
    const d = (x: Date) => x.toISOString().slice(0, 10);
    if (y.semesters.some((s) => d(s.startDate) < dto.startDate.slice(0, 10) || d(s.endDate) > dto.endDate.slice(0, 10))) {
      throw new BadRequestException({ code: 'SEMESTERS_OUTSIDE', message: 'A semester of this year would fall outside the new dates. Change the semester first.' });
    }
    const after = await this.prisma.academicYear.update({ where: { id }, data: { startDate: new Date(`${dto.startDate.slice(0, 10)}T00:00:00Z`), endDate: new Date(`${dto.endDate.slice(0, 10)}T00:00:00Z`) } });
    await this.audit.record({ action: 'academics.year_updated', module: 'academics', targetType: 'AcademicYear', targetId: id, before: { startDate: y.startDate, endDate: y.endDate }, after: { startDate: after.startDate, endDate: after.endDate } });
    return after;
  }

  async createSemester(yearId: string, dto: { number: number; startDate: string; endDate: string; minCredits?: number; maxCredits?: number }) {
    const y = await this.prisma.academicYear.findUnique({ where: { id: yearId }, include: { semesters: true } });
    if (!y) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Academic year not found.' });
    const problem = semesterDatesProblem(y, dto, y.semesters);
    if (problem) throw new BadRequestException({ code: 'SEMESTER', message: problem });
    const min = dto.minCredits ?? (dto.number === 3 ? 0 : 12);
    const max = dto.maxCredits ?? 24;
    if (min > max) throw new BadRequestException({ code: 'CREDIT_LIMITS', message: 'Minimum credits cannot be more than the maximum.' });
    const s = await this.prisma.semester.create({
      data: { academicYearId: yearId, number: dto.number, startDate: new Date(`${dto.startDate.slice(0, 10)}T00:00:00Z`), endDate: new Date(`${dto.endDate.slice(0, 10)}T00:00:00Z`), minCredits: min, maxCredits: max, isCurrent: false },
      select: SELECT,
    });
    await this.audit.record({ action: 'academics.semester_created', module: 'academics', targetType: 'Semester', targetId: s.id, after: { label: semesterLabel(s), startDate: dto.startDate, endDate: dto.endDate } });
    return { ...s, label: semesterLabel(s), registrationOpen: registrationOpen(s) };
  }

  /** Only a semester added by mistake: not current, and nothing (courses, registrations, bills...) uses it yet. */
  async deleteSemester(id: string) {
    const s = await this.prisma.semester.findUnique({ where: { id }, select: SELECT });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Semester not found.' });
    if (s.isCurrent) throw new ConflictException({ code: 'CURRENT', message: 'Make another semester current before deleting this one.' });
    try {
      await this.prisma.semester.delete({ where: { id } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === 'P2003' || err.code === 'P2014')) {
        throw new ConflictException({ code: 'IN_USE', message: 'This semester already has courses, registrations, fees or other records, so it cannot be deleted.' });
      }
      throw err;
    }
    await this.audit.record({ action: 'academics.semester_deleted', module: 'academics', targetType: 'Semester', targetId: id, before: { label: semesterLabel(s) } });
    return { ok: true };
  }

  async deleteYear(id: string) {
    const y = await this.prisma.academicYear.findUnique({ where: { id }, include: { _count: { select: { semesters: true } } } });
    if (!y) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Academic year not found.' });
    if (y._count.semesters) throw new ConflictException({ code: 'HAS_SEMESTERS', message: 'Delete its semesters first.' });
    await this.prisma.academicYear.delete({ where: { id } });
    await this.audit.record({ action: 'academics.year_deleted', module: 'academics', targetType: 'AcademicYear', targetId: id, before: { label: y.label } });
    return { ok: true };
  }
}
