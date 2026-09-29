import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import { belowMinimum } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JobsService, QUEUES } from '../../core/jobs/jobs.service';
import { loadEnv } from '../../core/config/env';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { OfferingsService } from '../offerings/offerings.service';
import { AttendancePolicyService } from './attendance-policy.service';
import { AttendanceSummaryService } from './attendance-summary.service';
import { codeAt, currentStep, secondsLeft } from './check-in-code';
import {
  CreateSessionDto,
  RegisterEntryDto,
  UpdateSessionDto,
} from './dto/attendance.dto';
import { AttendanceStatus } from '../../generated/prisma/client';

const MAX_REPEATS = 20;
const EARLY_MINUTES = 15;

/**
 * The lecturer's side of attendance for a class they teach:
 * class sessions, the register, and self check-in with a
 * rotating code. Any assigned lecturer or teaching assistant
 * can use it.
 */
@Injectable()
export class ClassSessionsService implements OnModuleInit {
  private readonly logger = new Logger(
    ClassSessionsService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly offerings: OfferingsService,
    private readonly policy: AttendancePolicyService,
    private readonly summary: AttendanceSummaryService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    await this.jobs.work(
      QUEUES.ATTENDANCE_CLOSE_CHECKINS,
      async () => {
        await this.closeExpired();
      },
    );

    await this.jobs.schedule(
      QUEUES.ATTENDANCE_CLOSE_CHECKINS,
      '*/5 * * * *',
    );
  }

  async overview(
    user: AuthUser,
    offeringId: string,
  ) {
    const offering = await this.access(
      user,
      offeringId,
    );

    const [sessions, roster, policy] =
      await Promise.all([
        this.prisma.classSession.findMany({
          where: {
            offeringId,
          },
          orderBy: {
            startsAt: 'asc',
          },
          select: {
            id: true,
            startsAt: true,
            durationMinutes: true,
            kind: true,
            topic: true,
            venue: true,
            cancelledAt: true,
            cancelReason: true,
            checkInClosesAt: true,
            attendanceTakenAt: true,
            records: {
              select: {
                status: true,
              },
            },
          },
        }),

        this.offerings.roster(offeringId),

        this.policy.get(),
      ]);

    const summaries =
      await this.summary.summaries({
        offeringIds: [offeringId],
      });

    const now = new Date();

    return {
      offering: {
        id: offering.id,
        course: offering.course,
        semesterLabel: `${offering.semester.academicYear.label}, Semester ${offering.semester.number}`,
        semester: {
          startDate: offering.semester.startDate,
          endDate: offering.semester.endDate,
        },
      },

      policy,

      sessions: sessions.map(
        ({ records, ...s }) => ({
          ...s,

          checkInOpen:
            !!s.checkInClosesAt &&
            s.checkInClosesAt > now,

          counts: {
            present: records.filter(
              (r) => r.status === 'PRESENT',
            ).length,

            late: records.filter(
              (r) => r.status === 'LATE',
            ).length,

            absent: records.filter(
              (r) => r.status === 'ABSENT',
            ).length,

            excused: records.filter(
              (r) => r.status === 'EXCUSED',
            ).length,
          },
        }),
      ),

      students: roster.map((s) => {
        const sum =
          summaries.get(
            AttendanceSummaryService.key(
              s.id,
              offeringId,
            ),
          ) ?? null;

        return {
          ...s,
          summary: sum,
          belowMinimum:
            !!sum &&
            belowMinimum(
              sum.percent,
              policy.minimumPercent,
            ),
        };
      }),
    };
  }

  async create(
    user: AuthUser,
    offeringId: string,
    dto: CreateSessionDto,
  ) {
    const offering = await this.access(
      user,
      offeringId,
    );

    const first = new Date(dto.startsAt);

    const until = dto.repeatWeeklyUntil
      ? new Date(
          `${dto.repeatWeeklyUntil.slice(
            0,
            10,
          )}T23:59:59Z`,
        )
      : first;

    const starts: Date[] = [];

    for (
      let d = new Date(first);
      d <= until &&
      starts.length < MAX_REPEATS;
      d = new Date(
        d.getTime() + 7 * 86_400_000,
      )
    ) {
      starts.push(d);
    }

    const semStart =
      offering.semester.startDate.getTime();

    const semEnd =
      offering.semester.endDate.getTime() +
      86_400_000;

    if (
      starts.some(
        (d) =>
          d.getTime() < semStart ||
          d.getTime() >= semEnd,
      )
    ) {
      throw new BadRequestException({
        code: 'OUTSIDE_SEMESTER',
        message:
          'Classes must fall within the semester dates.',
      });
    }

    await this.prisma.classSession.createMany({
      data: starts.map((startsAt) => ({
        offeringId,
        startsAt,
        durationMinutes: dto.durationMinutes,
        kind: dto.kind,
        topic: dto.topic?.trim() || null,
        venue: dto.venue?.trim() || null,
        createdById: user.id,
      })),
    });

    await this.audit.record({
      action: 'attendance.sessions_created',
      module: 'attendance',
      targetType: 'CourseOffering',
      targetId: offeringId,
      metadata: {
        course: offering.course.code,
        count: starts.length,
        first: first.toISOString(),
      },
    });

    return this.overview(
      user,
      offeringId,
    );
  }

  async update(
    user: AuthUser,
    offeringId: string,
    sessionId: string,
    dto: UpdateSessionDto,
  ) {
    await this.access(
      user,
      offeringId,
    );

    const session = await this.session(
      offeringId,
      sessionId,
    );

    if (session.attendanceTakenAt) {
      throw new ConflictException({
        code: 'ATTENDANCE_TAKEN',
        message:
          'Attendance was already taken for this class, so its time cannot change.',
      });
    }

    await this.prisma.classSession.update({
      where: {
        id: sessionId,
      },
      data: {
        startsAt: new Date(dto.startsAt),
        durationMinutes:
          dto.durationMinutes,
        kind: dto.kind,
        topic: dto.topic?.trim() || null,
        venue: dto.venue?.trim() || null,
      },
    });

    await this.audit.record({
      action: 'attendance.session_updated',
      module: 'attendance',
      targetType: 'ClassSession',
      targetId: sessionId,
      before: session,
      after: dto,
    });

    return this.overview(
      user,
      offeringId,
    );
  }

  async cancel(
    user: AuthUser,
    offeringId: string,
    sessionId: string,
    reason: string,
  ) {
    await this.access(
      user,
      offeringId,
    );

    const session = await this.session(
      offeringId,
      sessionId,
    );

    if (session.attendanceTakenAt) {
      throw new ConflictException({
        code: 'ATTENDANCE_TAKEN',
        message:
          'Attendance was already taken for this class. It cannot be cancelled.',
      });
    }

    await this.prisma.classSession.update({
      where: {
        id: sessionId,
      },
      data: {
        cancelledAt: new Date(),
        cancelReason: reason.trim(),
        checkInSecret: null,
        checkInClosesAt: null,
      },
    });

    await this.audit.record({
      action: 'attendance.session_cancelled',
      module: 'attendance',
      targetType: 'ClassSession',
      targetId: sessionId,
      metadata: {
        reason,
      },
    });

    return this.overview(
      user,
      offeringId,
    );
  }

  /**
   * The class list with each student's status
   * for this class. Students with an active excuse
   * show as excused.
   */
  async register(
    user: AuthUser,
    offeringId: string,
    sessionId: string,
  ) {
    await this.access(
      user,
      offeringId,
    );

    const session = await this.session(
      offeringId,
      sessionId,
    );

    const roster =
      await this.offerings.roster(
        offeringId,
      );

    const [records, excused] =
      await Promise.all([
        this.prisma.attendanceRecord.findMany({
          where: {
            sessionId,
          },
          select: {
            studentId: true,
            status: true,
            source: true,
            checkedInAt: true,
          },
        }),

        this.summary.excusedOn(
          roster.map((s) => s.id),
          session.startsAt,
        ),
      ]);

    const byStudent = new Map(
      records.map((r) => [
        r.studentId,
        r,
      ]),
    );

    return {
      session: {
        ...session,
        checkInSecret: undefined,
        checkInOpen:
          !!session.checkInClosesAt &&
          session.checkInClosesAt >
            new Date(),
      },

      students: roster.map((s) => {
        const r = byStudent.get(s.id);

        return {
          ...s,
          status:
            r?.status ??
            (excused.has(s.id)
              ? 'EXCUSED'
              : null),
          source: r?.source ?? null,
          checkedInAt:
            r?.checkedInAt ?? null,
          excused: excused.has(s.id),
        };
      }),
    };
  }

  async saveRegister(
    user: AuthUser,
    offeringId: string,
    sessionId: string,
    entries: RegisterEntryDto[],
  ) {
    await this.access(
      user,
      offeringId,
    );

    const session = await this.session(
      offeringId,
      sessionId,
    );

    this.assertStarted(session);

    const roster =
      await this.offerings.roster(
        offeringId,
      );

    const onRoster = new Set(
      roster.map((s) => s.id),
    );

    if (
      entries.some(
        (e) => !onRoster.has(e.studentId),
      )
    ) {
      throw new BadRequestException({
        code: 'STALE',
        message:
          'The class list has changed. Refresh and try again.',
      });
    }

    const excused =
      await this.summary.excusedOn(
        roster.map((s) => s.id),
        session.startsAt,
      );

    await this.prisma.$transaction(
      entries.map((e) => {
        /*
         * An absence covered by an excuse is
         * recorded as EXCUSED, so it never counts
         * against the student.
         *
         * Explicitly typing this as AttendanceStatus
         * prevents TypeScript from widening the value
         * to plain `string`.
         */
        const status: AttendanceStatus =
          e.status === 'ABSENT' &&
          excused.has(e.studentId)
            ? AttendanceStatus.EXCUSED
            : (e.status as AttendanceStatus);

        const data: {
          status: AttendanceStatus;
          source: 'LECTURER' | 'EXCUSE';
          markedById: string;
        } = {
          status,
          source:
            status === AttendanceStatus.EXCUSED
              ? 'EXCUSE'
              : 'LECTURER',
          markedById: user.id,
        };

        return this.prisma.attendanceRecord.upsert(
          {
            where: {
              sessionId_studentId: {
                sessionId,
                studentId: e.studentId,
              },
            },

            create: {
              sessionId,
              studentId: e.studentId,
              ...data,
            },

            update: data,
          },
        );
      }),
    );

    await this.prisma.classSession.update({
      where: {
        id: sessionId,
      },
      data: {
        attendanceTakenAt:
          session.attendanceTakenAt ??
          new Date(),
      },
    });

    await this.audit.record({
      action: 'attendance.register_saved',
      module: 'attendance',
      targetType: 'ClassSession',
      targetId: sessionId,
      metadata: {
        entries: entries.length,
        absent: entries.filter(
          (e) => e.status === 'ABSENT',
        ).length,
      },
    });

    await this.summary.evaluateWarnings(
      offeringId,
    );

    return this.register(
      user,
      offeringId,
      sessionId,
    );
  }

  async openCheckIn(
    user: AuthUser,
    offeringId: string,
    sessionId: string,
    minutes?: number,
  ) {
    await this.access(
      user,
      offeringId,
    );

    const session = await this.session(
      offeringId,
      sessionId,
    );

    this.assertStarted(session);

    const policy =
      await this.policy.get();

    const closesAt = new Date(
      Date.now() +
        (minutes ??
          policy.checkInMinutes) *
          60_000,
    );

    await this.prisma.classSession.update({
      where: {
        id: sessionId,
      },
      data: {
        checkInSecret:
          session.checkInSecret ??
          randomBytes(32).toString(
            'base64url',
          ),
        checkInOpenedAt:
          session.checkInOpenedAt ??
          new Date(),
        checkInClosesAt: closesAt,
      },
    });

    await this.audit.record({
      action: 'attendance.checkin_opened',
      module: 'attendance',
      targetType: 'ClassSession',
      targetId: sessionId,
      metadata: {
        closesAt,
      },
    });

    return this.checkInDisplay(
      user,
      offeringId,
      sessionId,
    );
  }

  /**
   * What the lecturer projects:
   * the current code, a QR code and a live count.
   * Poll every few seconds.
   */
  async checkInDisplay(
    user: AuthUser,
    offeringId: string,
    sessionId: string,
  ) {
    await this.access(
      user,
      offeringId,
    );

    const session = await this.session(
      offeringId,
      sessionId,
    );

    const open =
      !!session.checkInSecret &&
      !!session.checkInClosesAt &&
      session.checkInClosesAt >
        new Date();

    const [checkedIn, roster] =
      await Promise.all([
        this.prisma.attendanceRecord.count({
          where: {
            sessionId,
            source: 'CHECK_IN',
          },
        }),

        this.offerings.roster(
          offeringId,
        ),
      ]);

    if (!open) {
      return {
        open: false,
        checkedIn,
        rosterSize: roster.length,
        closesAt:
          session.checkInClosesAt,
      };
    }

    const code = codeAt(
      session.checkInSecret!,
      currentStep(),
    );

    const url =
      `${loadEnv().WEB_ORIGIN}/attendance?session=${sessionId}&code=${code}`;

    return {
      open: true,
      code,
      secondsLeft: secondsLeft(),
      qrDataUrl:
        await QRCode.toDataURL(url, {
          margin: 1,
          width: 320,
        }),
      checkedIn,
      rosterSize: roster.length,
      closesAt:
        session.checkInClosesAt,
    };
  }

  async closeCheckIn(
    user: AuthUser,
    offeringId: string,
    sessionId: string,
  ) {
    await this.access(
      user,
      offeringId,
    );

    await this.finalise(sessionId);

    await this.audit.record({
      action: 'attendance.checkin_closed',
      module: 'attendance',
      targetType: 'ClassSession',
      targetId: sessionId,
    });

    return this.register(
      user,
      offeringId,
      sessionId,
    );
  }

  /**
   * Runs every 5 minutes:
   * closes check-ins whose time is up.
   */
  async closeExpired() {
    const due =
      await this.prisma.classSession.findMany({
        where: {
          checkInSecret: {
            not: null,
          },
          checkInClosesAt: {
            lte: new Date(),
          },
        },
        select: {
          id: true,
        },
      });

    for (const s of due) {
      try {
        await this.finalise(s.id);
      } catch (err) {
        this.logger.error(
          `Could not close check-in for session ${s.id}: ${
            (err as Error).message
          }`,
        );
      }
    }
  }

  /**
   * Ends check-in; everyone on the class list
   * who did not check in is marked absent
   * (or excused).
   */
  private async finalise(
    sessionId: string,
  ) {
    const session =
      await this.prisma.classSession.findUniqueOrThrow(
        {
          where: {
            id: sessionId,
          },
        },
      );

    const roster =
      await this.offerings.roster(
        session.offeringId,
      );

    const existing = new Set(
      (
        await this.prisma.attendanceRecord.findMany(
          {
            where: {
              sessionId,
            },
            select: {
              studentId: true,
            },
          },
        )
      ).map((r) => r.studentId),
    );

    const missing = roster
      .filter(
        (s) => !existing.has(s.id),
      )
      .map((s) => s.id);

    const excused =
      await this.summary.excusedOn(
        missing,
        session.startsAt,
      );

    await this.prisma.$transaction([
      this.prisma.attendanceRecord.createMany({
        data: missing.map(
          (studentId) => ({
            sessionId,
            studentId,
            status: excused.has(
              studentId,
            )
              ? AttendanceStatus.EXCUSED
              : AttendanceStatus.ABSENT,
            source: excused.has(
              studentId,
            )
              ? 'EXCUSE'
              : 'LECTURER',
          }),
        ),
        skipDuplicates: true,
      }),

      this.prisma.classSession.update({
        where: {
          id: sessionId,
        },
        data: {
          checkInSecret: null,
          checkInClosesAt:
            session.checkInClosesAt &&
            session.checkInClosesAt <
              new Date()
              ? session.checkInClosesAt
              : new Date(),
          attendanceTakenAt:
            session.attendanceTakenAt ??
            new Date(),
        },
      }),
    ]);

    await this.summary.evaluateWarnings(
      session.offeringId,
    );
  }

  private assertStarted(session: {
    startsAt: Date;
    cancelledAt: Date | null;
  }) {
    if (session.cancelledAt) {
      throw new ConflictException({
        code: 'CANCELLED',
        message:
          'This class was cancelled.',
      });
    }

    if (
      session.startsAt.getTime() -
        Date.now() >
      EARLY_MINUTES * 60_000
    ) {
      throw new BadRequestException({
        code: 'NOT_STARTED',
        message: `Attendance can be taken from ${EARLY_MINUTES} minutes before the class starts.`,
      });
    }
  }

  private async session(
    offeringId: string,
    sessionId: string,
  ) {
    const s =
      await this.prisma.classSession.findFirst({
        where: {
          id: sessionId,
          offeringId,
        },
      });

    if (!s) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Class not found.',
      });
    }

    return s;
  }

  private async access(
    user: AuthUser,
    offeringId: string,
  ) {
    const offering =
      await this.prisma.courseOffering.findUnique({
        where: {
          id: offeringId,
        },
        select: {
          id: true,
          course: {
            select: {
              code: true,
              title: true,
            },
          },
          semester: {
            select: {
              number: true,
              startDate: true,
              endDate: true,
              academicYear: {
                select: {
                  label: true,
                },
              },
            },
          },
          lecturers: {
            where: {
              userId: user.id,
            },
            select: {
              userId: true,
            },
          },
        },
      });

    if (!offering) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Course not found.',
      });
    }

    if (!offering.lecturers.length) {
      throw new ForbiddenException({
        code: 'NOT_YOUR_CLASS',
        message:
          'You are not assigned to teach this course.',
      });
    }

    return offering;
  }
}