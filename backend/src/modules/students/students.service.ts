import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ROLE_KEYS, indexPrefix, renderIndexNumber } from '@anu/shared';

import { AuthUser } from '../../common/decorators/current-user.decorator';

import { PrismaService } from '../../core/prisma/prisma.service';
import { normaliseGhanaPhone } from '../../core/sms/sms.provider';
import { loadEnv } from '../../core/config/env';

import { AuditService } from '../audit/audit.service';
import { AccountSetupService } from '../account-setup/account-setup.service';

import { Prisma } from '../../generated/prisma/client';

import {
  ListStudentsDto,
  RegisterStudentDto,
} from './dto/student.dto';

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
      throw new BadRequestException({
        code: 'PHONE_INVALID',
        message: (e as Error).message,
      });
    }

    const programme =
      await this.prisma.programme.findUnique({
        where: { id: dto.programmeId },
        include: { level: true },
      });

    if (!programme || !programme.isActive) {
      throw new BadRequestException({
        code: 'PROGRAMME_INVALID',
        message: 'Choose an active programme.',
      });
    }

    if (!programme.level.isActive) {
      throw new BadRequestException({
        code: 'LEVEL_INACTIVE',
        message:
          'This programme level is not accepting registrations.',
      });
    }

    const studentRole =
      await this.prisma.role.findUniqueOrThrow({
        where: { key: ROLE_KEYS.STUDENT },
      });

    try {
      const created =
        await this.prisma.$transaction(async (tx) => {
          // The Registrar's format for this programme type decides the number.
          // The counter is keyed by everything except the running number, so
          // formats that share a prefix share a sequence, and a new counter
          // starts after the highest number already issued with that prefix.
          const format = programme.level.indexFormat;

          let prefix: string;

          try {
            prefix = indexPrefix(
              format,
              dto.admissionYear,
              programme.levelCode,
              programme.indexCode,
            );
          } catch (e) {
            throw new BadRequestException({
              code: 'INDEX_CODE',
              message: (e as Error).message,
            });
          }

          const digits =
            Number(
              /\{SEQ:(\d)\}/.exec(format)?.[1] ?? 5,
            );

          const pattern =
            `^${prefix.replace(/[/-]/g, '\\$&')}[0-9]{${digits}}$`;

          const [counter] =
            await tx.$queryRaw<{ lastValue: number }[]>`
              INSERT INTO "IndexNumberCounter"
                ("admissionYear", "levelCode", "lastValue", "updatedAt")
              VALUES (
                ${dto.admissionYear},
                ${prefix},
                (
                  SELECT COALESCE(
                    MAX(
                      CAST(
                        RIGHT("indexNumber", ${digits})
                        AS INTEGER
                      )
                    ),
                    0
                  ) + 1
                  FROM "User"
                  WHERE "indexNumber" ~ ${pattern}
                ),
                NOW()
              )
              ON CONFLICT ("admissionYear", "levelCode")
              DO UPDATE SET
                "lastValue" =
                  "IndexNumberCounter"."lastValue" + 1,
                "updatedAt" = NOW()
              RETURNING "lastValue"
            `;

          const indexNumber = renderIndexNumber(
            format,
            {
              year: dto.admissionYear,
              code: programme.levelCode,
              sequence: Number(counter.lastValue),
              programmeCode: programme.indexCode,
            },
          );

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

              roles: {
                create: {
                  roleId: studentRole.id,
                },
              },

              studentProfile: {
                create: {
                  programmeId: programme.id,
                  levelCode: programme.levelCode,
                  admissionYear: dto.admissionYear,
                  dateOfBirth: dto.dateOfBirth
                    ? new Date(dto.dateOfBirth)
                    : undefined,
                  gender: dto.gender,
                  nationality: dto.nationality,
                },
              },
            },

            select: {
              id: true,
              indexNumber: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              status: true,
              studentProfile: true,
            },
          });
        });

      await this.audit.record({
        action: 'student.registered',
        module: 'students',
        targetType: 'User',
        targetId: created.id,
        after: created,
      });

      await this.setup.sendSetupLink(created.id);

      return created;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'EMAIL_TAKEN',
          message:
            'An account with this email already exists.',
        });
      }

      throw err;
    }
  }

  async resendSetup(id: string) {
    const student =
      await this.prisma.user.findFirst({
        where: {
          id,
          type: 'STUDENT',
        },
        select: {
          id: true,
        },
      });

    if (!student) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Student not found.',
      });
    }

    await this.setup.sendSetupLink(id);
  }

  async list(q: ListStudentsDto) {
    const where: Prisma.UserWhereInput = {
      type: 'STUDENT',
      deletedAt: null,

      ...(q.programmeId || q.admissionYear
        ? {
            studentProfile: {
              ...(q.programmeId
                ? {
                    programmeId: q.programmeId,
                  }
                : {}),
              ...(q.admissionYear
                ? {
                    admissionYear: q.admissionYear,
                  }
                : {}),
            },
          }
        : {}),

      ...(q.search
        ? {
            OR: [
              {
                indexNumber: {
                  contains: q.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                firstName: {
                  contains: q.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                lastName: {
                  contains: q.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                email: {
                  contains: q.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] =
      await this.prisma.$transaction([
        this.prisma.user.findMany({
          where,
          orderBy: {
            indexNumber: 'asc',
          },
          skip: (q.page - 1) * q.pageSize,
          take: q.pageSize,

          select: {
            id: true,
            indexNumber: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
            isDemo: true,

            studentProfile: {
              select: {
                admissionYear: true,
                currentLevel: true,
                programme: {
                  select: {
                    code: true,
                    name: true,
                  },
                },
              },
            },
          },
        }),

        this.prisma.user.count({
          where,
        }),
      ]);

    return {
      items,
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async get(id: string) {
    const student =
      await this.prisma.user.findFirst({
        where: {
          id,
          type: 'STUDENT',
        },

        select: {
          id: true,
          indexNumber: true,
          firstName: true,
          middleName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,

          studentProfile: {
            include: {
              programme: {
                select: {
                  code: true,
                  name: true,
                  department: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    if (!student) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Student not found.',
      });
    }

    await this.audit.record({
      action: 'student.viewed',
      module: 'students',
      targetType: 'User',
      targetId: id,
    });

    return student;
  }

  /**
   * Suspend (for example a disciplinary matter or a stolen password), deactivate (left the university)
   * or reactivate a student account. Suspending ends every session at once; records are kept.
   */
  async setStatus(
    actor: AuthUser,
    id: string,
    status:
      | 'ACTIVE'
      | 'SUSPENDED'
      | 'DEACTIVATED',
    reason: string,
  ) {
    const student =
      await this.prisma.user.findFirst({
        where: {
          id,
          type: 'STUDENT',
        },

        select: {
          id: true,
          status: true,
          indexNumber: true,
        },
      });

    if (!student) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Student not found.',
      });
    }

    if (
      student.status === 'PENDING_SETUP' &&
      status === 'ACTIVE'
    ) {
      throw new BadRequestException({
        code: 'PENDING',
        message:
          'This student has not set up their account yet. Resend the setup link instead.',
      });
    }

    if (student.status === status) {
      return { status };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          status,
          ...(status === 'ACTIVE'
            ? {
                failedLoginCount: 0,
                lockedUntil: null,
              }
            : {}),
        },
      });

      if (status !== 'ACTIVE') {
        await tx.session.updateMany({
          where: {
            userId: id,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        });
      }
    });

    await this.audit.record({
      action: 'students.status_changed',
      module: 'students',
      targetType: 'User',
      targetId: id,
      before: {
        status: student.status,
      },
      after: {
        status,
        reason,
      },
      metadata: {
        indexNumber: student.indexNumber,
      },
    });

    return { status };
  }
}