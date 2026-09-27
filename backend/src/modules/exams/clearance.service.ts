import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { SemestersService } from '../academics/semesters.service';
import { BulkClearanceDto, ClearanceListDto } from './dto/exams.dto';

/** Finance Office view: students with approved courses this semester, and whether they are cleared. */
@Injectable()
export class ClearanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly semesters: SemestersService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ClearanceListDto) {
    const semester = await this.semesters.resolve(q.semesterId);
    const where: Prisma.UserWhereInput = {
      type: 'STUDENT',
      registrations: { some: { semesterId: semester.id, status: 'APPROVED' } },
      ...(q.status === 'CLEARED' ? { clearances: { some: { semesterId: semester.id, cleared: true } } } : {}),
      ...(q.status === 'NOT_CLEARED' ? { clearances: { none: { semesterId: semester.id, cleared: true } } } : {}),
      ...(q.search
        ? { OR: [{ indexNumber: { contains: q.search, mode: 'insensitive' as const } }, { firstName: { contains: q.search, mode: 'insensitive' as const } }, { lastName: { contains: q.search, mode: 'insensitive' as const } }] }
        : {}),
    };
    const base = { type: 'STUDENT' as const, registrations: { some: { semesterId: semester.id, status: 'APPROVED' as const } } };
    const [rows, total, all, cleared] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { indexNumber: 'asc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true, indexNumber: true, firstName: true, middleName: true, lastName: true,
          studentProfile: { select: { currentLevel: true, programme: { select: { name: true } } } },
          clearances: { where: { semesterId: semester.id }, select: { cleared: true, note: true, updatedAt: true } },
        },
      }),
      this.prisma.user.count({ where }),
      this.prisma.user.count({ where: base }),
      this.prisma.user.count({ where: { ...base, clearances: { some: { semesterId: semester.id, cleared: true } } } }),
    ]);
    return {
      semester,
      items: rows.map(({ clearances, ...r }) => ({ ...r, clearance: clearances[0] ?? null })),
      total,
      page: q.page,
      pageSize: q.pageSize,
      counts: { students: all, cleared, notCleared: all - cleared },
    };
  }

  /** Marks many students at once, e.g. index numbers pasted from the Finance Office's spreadsheet. */
  async bulkSet(user: AuthUser, dto: BulkClearanceDto) {
    const semester = await this.semesters.resolve(dto.semesterId);
    const wanted = [...new Set(dto.indexNumbers.map((i) => i.trim().toUpperCase()).filter(Boolean))];
    const students = await this.prisma.user.findMany({ where: { type: 'STUDENT', indexNumber: { in: wanted } }, select: { id: true, indexNumber: true } });
    const found = new Set(students.map((s) => s.indexNumber));
    await this.prisma.$transaction(
      students.map((s) =>
        this.prisma.financialClearance.upsert({
          where: { studentId_semesterId: { studentId: s.id, semesterId: semester.id } },
          create: { studentId: s.id, semesterId: semester.id, cleared: dto.cleared, note: dto.note, updatedById: user.id },
          update: { cleared: dto.cleared, note: dto.note, updatedById: user.id },
        }),
      ),
    );
    await this.audit.record({
      action: dto.cleared ? 'finance.clearance_granted' : 'finance.clearance_revoked',
      module: 'exams',
      metadata: { semester: semester.label, students: students.length, indexNumbers: students.map((s) => s.indexNumber), note: dto.note },
    });
    return { updated: students.length, notFound: wanted.filter((i) => !found.has(i)) };
  }
}
