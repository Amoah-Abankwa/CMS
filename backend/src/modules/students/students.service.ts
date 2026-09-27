import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ROLE_KEYS } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { normaliseGhanaPhone } from '../../core/sms/sms.provider';
import { loadEnv } from '../../core/config/env';
import { AuditService } from '../audit/audit.service';
import { AccountSetupService } from '../account-setup/account-setup.service';
import { Prisma } from '../../generated/prisma/client';
import { formatIndexNumber } from './index-number';
import { ListStudentsDto, RegisterStudentDto } from './dto/student.dto';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly setup: AccountSetupService,
  ) {}

  /**
   * Registers a student. The account, profile, student role and index number are created in one
   * transaction. The index sequence uses an atomic upsert, so concurrent registrations never collide.
   */
  async register(dto: RegisterStudentDto) {
    let phone: string;
    try {
      phone = normaliseGhanaPhone(dto.phone);
    } catch (e) {
      throw new BadRequestException({ code: 'PHONE_INVALID', message: (e as Error).message });
    }

    const programme = await this.prisma.programme.findUnique({ where: { id: dto.programmeId }, include: { level: true } });
    if (!programme || !programme.isActive) throw new BadRequestException({ code: 'PROGRAMME_INVALID', message: 'Choose an active programme.' });
    if (!programme.level.isActive) throw new BadRequestException({ code: 'LEVEL_INACTIVE', message: 'This programme level is not accepting registrations.' });

    const studentRole = await this.prisma.role.findUniqueOrThrow({ where: { key: ROLE_KEYS.STUDENT } });

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const [counter] = await tx.$queryRaw<{ lastValue: number }[]>`
          INSERT INTO "IndexNumberCounter" ("admissionYear", "levelCode", "lastValue", "updatedAt")
          VALUES (${dto.admissionYear}, ${programme.levelCode}, 1, NOW())
          ON CONFLICT ("admissionYear", "levelCode")
          DO UPDATE SET "lastValue" = "IndexNumberCounter"."lastValue" + 1, "updatedAt" = NOW()
          RETURNING "lastValue"`;
        const indexNumber = formatIndexNumber(dto.admissionYear, programme.levelCode, Number(counter.lastValue));

        return tx.user.create({
          data: {
            type: 'STUDENT',
            firstName: dto.firstName,
            middleName: dto.middleName,
            lastName: dto.lastName,
            email: dto.email,
            phone,
            indexNumber,
            // No password yet: the student chooses one from the emailed setup link.
            status: 'PENDING_SETUP',
            primaryRoleKey: ROLE_KEYS.STUDENT,
            isDemo: loadEnv().DEMO_MODE,
            roles: { create: { roleId: studentRole.id } },
            studentProfile: {
              create: {
                programmeId: programme.id,
                levelCode: programme.levelCode,
                admissionYear: dto.admissionYear,
                dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
                gender: dto.gender,
                nationality: dto.nationality,
              },
            },
          },
          select: { id: true, indexNumber: true, firstName: true, lastName: true, email: true, phone: true, status: true, studentProfile: true },
        });
      });

      await this.audit.record({ action: 'student.registered', module: 'students', targetType: 'User', targetId: created.id, after: created });
      await this.setup.sendSetupLink(created.id);
      return created;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'An account with this email already exists.' });
      }
      throw err;
    }
  }

  async resendSetup(id: string) {
    const student = await this.prisma.user.findFirst({ where: { id, type: 'STUDENT' }, select: { id: true } });
    if (!student) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Student not found.' });
    await this.setup.sendSetupLink(id);
  }

  async list(q: ListStudentsDto) {
    const where: Prisma.UserWhereInput = {
      type: 'STUDENT',
      deletedAt: null,
      ...(q.programmeId || q.admissionYear
        ? { studentProfile: { ...(q.programmeId ? { programmeId: q.programmeId } : {}), ...(q.admissionYear ? { admissionYear: q.admissionYear } : {}) } }
        : {}),
      ...(q.search
        ? {
            OR: [
              { indexNumber: { contains: q.search, mode: 'insensitive' as const } },
              { firstName: { contains: q.search, mode: 'insensitive' as const } },
              { lastName: { contains: q.search, mode: 'insensitive' as const } },
              { email: { contains: q.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { indexNumber: 'asc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true, indexNumber: true, firstName: true, middleName: true, lastName: true, email: true, phone: true, status: true, isDemo: true,
          studentProfile: { select: { admissionYear: true, currentLevel: true, programme: { select: { code: true, name: true } } } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async get(id: string) {
    const student = await this.prisma.user.findFirst({
      where: { id, type: 'STUDENT' },
      select: {
        id: true, indexNumber: true, firstName: true, middleName: true, lastName: true, email: true, phone: true, status: true, createdAt: true,
        studentProfile: { include: { programme: { select: { code: true, name: true, department: { select: { name: true } } } } } },
      },
    });
    if (!student) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Student not found.' });
    await this.audit.record({ action: 'student.viewed', module: 'students', targetType: 'User', targetId: id });
    return student;
  }
}
