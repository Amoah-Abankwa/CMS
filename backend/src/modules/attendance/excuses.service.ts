import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { AttendanceSummaryService } from './attendance-summary.service';
import { ExcuseDto, ExcuseListDto } from './dto/attendance.dto';

/** Excused absences, e.g. a medical excuse from Health Services. Lecturers see "excused", never why. */
@Injectable()
export class ExcusesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly summary: AttendanceSummaryService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ExcuseListDto) {
    const where = q.search
      ? { student: { OR: [{ indexNumber: { contains: q.search, mode: 'insensitive' as const } }, { firstName: { contains: q.search, mode: 'insensitive' as const } }, { lastName: { contains: q.search, mode: 'insensitive' as const } }] } }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.attendanceExcuse.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true, fromDate: true, toDate: true, category: true, note: true, createdAt: true, revokedAt: true, revokeReason: true, recordedById: true,
          student: { select: { id: true, indexNumber: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.attendanceExcuse.count({ where }),
    ]);
    const staff = new Map(
      (await this.prisma.user.findMany({ where: { id: { in: [...new Set(items.map((i) => i.recordedById))] } }, select: { id: true, firstName: true, lastName: true } })).map((u) => [u.id, `${u.firstName} ${u.lastName}`]),
    );
    return { items: items.map((i) => ({ ...i, recordedBy: staff.get(i.recordedById) ?? null })), total, page: q.page, pageSize: q.pageSize };
  }

  async record(user: AuthUser, dto: ExcuseDto) {
    const student = await this.prisma.user.findUnique({ where: { indexNumber: dto.indexNumber }, select: { id: true, type: true } });
    if (!student || student.type !== 'STUDENT') throw new NotFoundException({ code: 'NOT_FOUND', message: 'No student has that index number.' });
    const from = new Date(`${dto.fromDate.slice(0, 10)}T00:00:00Z`);
    const to = new Date(`${dto.toDate.slice(0, 10)}T00:00:00Z`);
    if (to < from) throw new BadRequestException({ code: 'DATES', message: 'The end date must be on or after the start date.' });
    if ((to.getTime() - from.getTime()) / 86_400_000 > 60) throw new BadRequestException({ code: 'TOO_LONG', message: 'An excuse can cover at most 60 days. Record longer absences in parts.' });

    const excuse = await this.prisma.attendanceExcuse.create({
      data: { studentId: student.id, fromDate: from, toDate: to, category: dto.category, note: dto.note.trim(), recordedById: user.id },
    });
    const affected = await this.summary.reapplyExcuses(student.id, from, to);
    await this.audit.record({ action: 'attendance.excuse_recorded', module: 'attendance', targetType: 'User', targetId: student.id, after: { from: dto.fromDate, to: dto.toDate, category: dto.category }, metadata: { coursesAffected: affected } });
    return { excuse, coursesAffected: affected };
  }

  async revoke(user: AuthUser, id: string, reason: string) {
    const excuse = await this.prisma.attendanceExcuse.findUnique({ where: { id } });
    if (!excuse) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Excuse not found.' });
    if (excuse.revokedAt) throw new ConflictException({ code: 'ALREADY_REVOKED', message: 'This excuse was already withdrawn.' });
    await this.prisma.attendanceExcuse.update({ where: { id }, data: { revokedAt: new Date(), revokedById: user.id, revokeReason: reason.trim() } });
    const affected = await this.summary.reapplyExcuses(excuse.studentId, excuse.fromDate, excuse.toDate);
    await this.audit.record({ action: 'attendance.excuse_revoked', module: 'attendance', targetType: 'User', targetId: excuse.studentId, metadata: { reason, coursesAffected: affected } });
    return { ok: true, coursesAffected: affected };
  }
}
