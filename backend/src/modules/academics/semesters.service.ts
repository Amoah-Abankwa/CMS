import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
  return `${s.academicYear.label}, Semester ${s.number}`;
}

const SELECT = {
  id: true, number: true, startDate: true, endDate: true, isCurrent: true,
  registrationOpensAt: true, registrationClosesAt: true, minCredits: true, maxCredits: true,
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
    dto: { registrationOpensAt?: string | null; registrationClosesAt?: string | null; minCredits?: number; maxCredits?: number; isCurrent?: boolean },
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

    const after = await this.prisma.$transaction(async (tx) => {
      if (dto.isCurrent) await tx.semester.updateMany({ where: { id: { not: id } }, data: { isCurrent: false } });
      return tx.semester.update({
        where: { id },
        data: { registrationOpensAt: opens, registrationClosesAt: closes, minCredits: min, maxCredits: max, ...(dto.isCurrent !== undefined ? { isCurrent: dto.isCurrent } : {}) },
        select: SELECT,
      });
    });
    await this.audit.record({ action: 'semester.updated', module: 'academics', targetType: 'Semester', targetId: id, before, after });
    return { ...after, label: semesterLabel(after), registrationOpen: registrationOpen(after) };
  }
}
