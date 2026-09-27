import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { SemestersService } from '../academics/semesters.service';
import { HoldDto } from './dto/exams.dto';

@Injectable()
export class HoldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly semesters: SemestersService,
    private readonly audit: AuditService,
  ) {}

  async list(semesterId?: string) {
    const semester = await this.semesters.resolve(semesterId);
    const holds = await this.prisma.examHold.findMany({
      where: { semesterId: semester.id },
      orderBy: [{ liftedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
      select: {
        id: true, category: true, reason: true, createdAt: true, liftedAt: true, liftReason: true, placedById: true,
        student: { select: { id: true, indexNumber: true, firstName: true, lastName: true } },
        offering: { select: { id: true, course: { select: { code: true, title: true } } } },
      },
    });
    const staffIds = [...new Set(holds.map((h) => h.placedById))];
    const staff = new Map((await this.prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, firstName: true, lastName: true } })).map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    return { semester, items: holds.map((h) => ({ ...h, placedBy: staff.get(h.placedById) ?? null })) };
  }

  /** Courses the student is approved for, so a hold can target one paper. */
  async studentCourses(indexNumber: string, semesterId?: string) {
    const semester = await this.semesters.resolve(semesterId);
    const student = await this.prisma.user.findUnique({
      where: { indexNumber: indexNumber.trim().toUpperCase() },
      select: { id: true, type: true, indexNumber: true, firstName: true, lastName: true },
    });
    if (!student || student.type !== 'STUDENT') throw new NotFoundException({ code: 'NOT_FOUND', message: 'No student has that index number.' });
    const offerings = await this.prisma.courseOffering.findMany({
      where: { semesterId: semester.id, items: { some: { registration: { studentId: student.id, status: 'APPROVED' } } } },
      orderBy: { course: { code: 'asc' } },
      select: { id: true, course: { select: { code: true, title: true } } },
    });
    return { student, offerings };
  }

  async place(user: AuthUser, dto: HoldDto) {
    const semester = await this.semesters.resolve(dto.semesterId);
    const { student, offerings } = await this.studentCourses(dto.indexNumber, semester.id);
    if (dto.offeringId && !offerings.some((o) => o.id === dto.offeringId)) {
      throw new BadRequestException({ code: 'NOT_REGISTERED', message: 'The student is not approved for that course this semester.' });
    }
    const duplicate = await this.prisma.examHold.findFirst({ where: { studentId: student.id, semesterId: semester.id, offeringId: dto.offeringId ?? null, liftedAt: null } });
    if (duplicate) throw new ConflictException({ code: 'HOLD_EXISTS', message: 'This student already has an active hold for that. Lift it first to replace it.' });

    const hold = await this.prisma.examHold.create({
      data: { studentId: student.id, semesterId: semester.id, offeringId: dto.offeringId ?? null, category: dto.category, reason: dto.reason.trim(), placedById: user.id },
    });
    await this.audit.record({ action: 'exams.hold_placed', module: 'exams', targetType: 'User', targetId: student.id, after: { category: dto.category, offeringId: dto.offeringId ?? 'all papers', reason: dto.reason } });
    return hold;
  }

  async lift(user: AuthUser, id: string, reason: string) {
    const hold = await this.prisma.examHold.findUnique({ where: { id } });
    if (!hold) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Hold not found.' });
    if (hold.liftedAt) throw new ConflictException({ code: 'ALREADY_LIFTED', message: 'This hold was already lifted.' });
    const lifted = await this.prisma.examHold.update({ where: { id }, data: { liftedAt: new Date(), liftedById: user.id, liftReason: reason.trim() } });
    await this.audit.record({ action: 'exams.hold_lifted', module: 'exams', targetType: 'User', targetId: hold.studentId, before: hold, after: lifted });
    return lifted;
  }
}
