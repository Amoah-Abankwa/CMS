import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  findTimetableIssues,
  type ScheduledPaper,
} from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { SemestersService } from '../academics/semesters.service';
import { SessionDto } from './dto/exams.dto';

/** What students see for one paper. Stored in the timetable's published snapshot. */
export interface PublishedPaper {
  offeringId: string;
  courseCode: string;
  courseTitle: string;
  startsAt: string;
  durationMinutes: number;
  venue: string | null;
  notes: string | null;
}

const SESSION_SELECT = {
  id: true,
  offeringId: true,
  startsAt: true,
  durationMinutes: true,
  notes: true,
  updatedAt: true,
  venue: {
    select: {
      id: true,
      name: true,
      capacity: true,
    },
  },
  invigilators: {
    select: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  },
  offering: {
    select: {
      course: {
        select: {
          code: true,
          title: true,
          department: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ExamSessionSelect;

type SessionRow =
  Prisma.ExamSessionGetPayload<{
    select: typeof SESSION_SELECT;
  }>;

function toPublished(
  s: SessionRow,
): PublishedPaper {
  return {
    offeringId: s.offeringId,
    courseCode: s.offering.course.code,
    courseTitle: s.offering.course.title,
    startsAt: s.startsAt.toISOString(),
    durationMinutes: s.durationMinutes,
    venue: s.venue?.name ?? null,
    notes: s.notes,
  };
}

const samePaper = (
  a?: PublishedPaper,
  b?: PublishedPaper,
) =>
  !!a &&
  !!b &&
  a.startsAt === b.startsAt &&
  a.durationMinutes ===
    b.durationMinutes &&
  a.venue === b.venue &&
  (a.notes ?? null) ===
    (b.notes ?? null);

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(
    'en-GB',
    {
      timeZone: 'Africa/Accra',
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    },
  );

@Injectable()
export class TimetableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly semesters: SemestersService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Approved students per offering in the semester. */
  async enrolment(
    semesterId: string,
  ) {
    const items =
      await this.prisma.courseRegistrationItem.findMany(
        {
          where: {
            registration: {
              semesterId,
              status: 'APPROVED',
            },
          },
          select: {
            offeringId: true,
            registration: {
              select: {
                studentId: true,
              },
            },
          },
        },
      );

    const map = new Map<
      string,
      Set<string>
    >();

    for (const i of items) {
      if (!map.has(i.offeringId)) {
        map.set(
          i.offeringId,
          new Set(),
        );
      }

      map
        .get(i.offeringId)!
        .add(i.registration.studentId);
    }

    return map;
  }

  async overview(
    semesterId?: string,
  ) {
    const semester =
      await this.semesters.resolve(
        semesterId,
      );

    const timetable =
      await this.ensure(semester.id);

    const [
      sessions,
      enrolled,
      offerings,
    ] = await Promise.all([
      this.prisma.examSession.findMany({
        where: {
          timetableId: timetable.id,
        },
        orderBy: {
          startsAt: 'asc',
        },
        select: SESSION_SELECT,
      }),

      this.enrolment(semester.id),

      this.prisma.courseOffering.findMany(
        {
          where: {
            semesterId: semester.id,
          },
          orderBy: {
            course: {
              code: 'asc',
            },
          },
          select: {
            id: true,
            course: {
              select: {
                code: true,
                title: true,
                department: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      ),
    ]);

    const papers: ScheduledPaper[] =
      sessions.map((s) => ({
        sessionId: s.id,
        offeringId: s.offeringId,
        label: s.offering.course.code,
        start: s.startsAt,
        end: new Date(
          s.startsAt.getTime() +
            s.durationMinutes * 60_000,
        ),
        venueId:
          s.venue?.id ?? null,
        venueName:
          s.venue?.name ?? null,
        venueCapacity:
          s.venue?.capacity ?? null,
        invigilatorIds:
          s.invigilators.map(
            (i) => i.user.id,
          ),
      }));

    const needing = offerings
      .filter(
        (o) =>
          (enrolled.get(o.id)?.size ??
            0) > 0,
      )
      .map((o) => ({
        offeringId: o.id,
        label: o.course.code,
      }));

    const issues = findTimetableIssues(
      papers,
      enrolled,
      needing,
    );

    const snapshot =
      (timetable.publishedSnapshot ??
        {}) as unknown as Record<
        string,
        PublishedPaper
      >;

    const current = Object.fromEntries(
      sessions.map((s) => [
        s.offeringId,
        toPublished(s),
      ]),
    );

    const changedOfferingIds = [
      ...new Set([
        ...Object.keys(snapshot),
        ...Object.keys(current),
      ]),
    ].filter(
      (id) =>
        !samePaper(
          snapshot[id],
          current[id],
        ),
    );

    const scheduled = new Set(
      sessions.map(
        (s) => s.offeringId,
      ),
    );

    return {
      semester,

      timetable: {
        id: timetable.id,
        status: timetable.status,
        publishedAt:
          timetable.publishedAt,
        publishedVersion:
          timetable.publishedVersion,
      },

      sessions: sessions.map(
        (s) => ({
          id: s.id,
          offeringId: s.offeringId,
          course: s.offering.course,
          startsAt: s.startsAt,
          durationMinutes:
            s.durationMinutes,
          venue: s.venue,
          notes: s.notes,
          students:
            enrolled.get(
              s.offeringId,
            )?.size ?? 0,
          invigilators:
            s.invigilators.map(
              (i) => ({
                id: i.user.id,
                name: `${i.user.firstName} ${i.user.lastName}`,
              }),
            ),
          changedSincePublish:
            timetable.publishedVersion >
              0 &&
            changedOfferingIds.includes(
              s.offeringId,
            ),
        }),
      ),

      unscheduled: offerings
        .filter(
          (o) =>
            !scheduled.has(o.id),
        )
        .map((o) => ({
          offeringId: o.id,
          course: o.course,
          students:
            enrolled.get(o.id)?.size ??
            0,
        })),

      issues,

      pendingChanges:
        timetable.publishedVersion ===
        0
          ? sessions.length
          : changedOfferingIds.length,
    };
  }

  async saveSession(
    dto: SessionDto,
  ) {
    const offering =
      await this.prisma.courseOffering.findUnique(
        {
          where: {
            id: dto.offeringId,
          },
          select: {
            id: true,
            semesterId: true,
            course: {
              select: {
                code: true,
              },
            },
          },
        },
      );

    if (!offering) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message:
          'Course offering not found.',
      });
    }

    if (dto.venueId) {
      const venue =
        await this.prisma.examVenue.findUnique(
          {
            where: {
              id: dto.venueId,
            },
          },
        );

      if (!venue?.isActive) {
        throw new BadRequestException({
          code: 'VENUE_INVALID',
          message:
            'Choose an active venue.',
        });
      }
    }

    const invigilators = [
      ...new Set(dto.invigilatorIds),
    ];

    const staff =
      await this.prisma.user.count({
        where: {
          id: {
            in: invigilators,
          },
          type: 'STAFF',
          status: 'ACTIVE',
        },
      });

    if (
      staff !== invigilators.length
    ) {
      throw new BadRequestException({
        code: 'INVIGILATOR_INVALID',
        message:
          'Invigilators must be active staff members.',
      });
    }

    const timetable =
      await this.ensure(
        offering.semesterId,
      );

    const data = {
      startsAt: new Date(
        dto.startsAt,
      ),
      durationMinutes:
        dto.durationMinutes,
      venueId: dto.venueId ?? null,
      notes: dto.notes?.trim() || null,
    };

    const session =
      await this.prisma.$transaction(
        async (tx) => {
          const s =
            await tx.examSession.upsert(
              {
                where: {
                  offeringId:
                    offering.id,
                },
                create: {
                  ...data,
                  offeringId:
                    offering.id,
                  timetableId:
                    timetable.id,
                },
                update: data,
              },
            );

          await tx.examInvigilator.deleteMany(
            {
              where: {
                sessionId: s.id,
              },
            },
          );

          if (invigilators.length) {
            await tx.examInvigilator.createMany(
              {
                data: invigilators.map(
                  (userId) => ({
                    sessionId: s.id,
                    userId,
                  }),
                ),
              },
            );
          }

          return s;
        },
      );

    await this.audit.record({
      action:
        'exams.paper_scheduled',
      module: 'exams',
      targetType: 'ExamSession',
      targetId: session.id,
      after: {
        course: offering.course.code,
        ...data,
        invigilators,
      },
    });

    return this.overview(
      offering.semesterId,
    );
  }

  async removeSession(id: string) {
    const s =
      await this.prisma.examSession.findUnique(
        {
          where: {
            id,
          },
          select: {
            id: true,
            timetable: {
              select: {
                semesterId: true,
              },
            },
            offering: {
              select: {
                course: {
                  select: {
                    code: true,
                  },
                },
              },
            },
          },
        },
      );

    if (!s) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message:
          'Exam paper not found.',
      });
    }

    await this.prisma.examSession.delete(
      {
        where: {
          id,
        },
      },
    );

    await this.audit.record({
      action:
        'exams.paper_removed',
      module: 'exams',
      targetType: 'ExamSession',
      targetId: id,
      before: {
        course:
          s.offering.course.code,
      },
    });

    return this.overview(
      s.timetable.semesterId,
    );
  }

  /**
   * Publishes the timetable. The first time,
   * every student with approved courses is told.
   * After that, only students whose papers changed
   * are told, with a list of what changed.
   */
  async publish(
    semesterId?: string,
  ) {
    const view =
      await this.overview(
        semesterId,
      );

    const errors = view.issues.filter(
      (i) => i.severity === 'error',
    );

    if (errors.length) {
      throw new ConflictException({
        code: 'TIMETABLE_CLASHES',
        message: `Fix ${
          errors.length
        } clash${
          errors.length === 1
            ? ''
            : 'es'
        } before publishing. ${
          errors[0].message
        }`,
        details: errors,
      });
    }

    if (view.sessions.length === 0) {
      throw new BadRequestException({
        code: 'EMPTY',
        message:
          'Schedule at least one paper before publishing.',
      });
    }

    if (
      view.timetable.publishedVersion >
        0 &&
      view.pendingChanges === 0
    ) {
      throw new ConflictException({
        code: 'NOTHING_CHANGED',
        message:
          'Nothing has changed since the timetable was last published.',
      });
    }

    const timetable =
      await this.prisma.examTimetable.findUniqueOrThrow(
        {
          where: {
            id: view.timetable.id,
          },
        },
      );

    const previous =
      (timetable.publishedSnapshot ??
        {}) as unknown as Record<
        string,
        PublishedPaper
      >;

    const sessions =
      await this.prisma.examSession.findMany(
        {
          where: {
            timetableId: timetable.id,
          },
          select: SESSION_SELECT,
        },
      );

    const snapshot: Record<
      string,
      PublishedPaper
    > = Object.fromEntries(
      sessions.map((s) => [
        s.offeringId,
        toPublished(s),
      ]),
    );

    const firstTime =
      timetable.publishedVersion === 0;

    const changed = [
      ...new Set([
        ...Object.keys(previous),
        ...Object.keys(snapshot),
      ]),
    ].filter(
      (id) =>
        !samePaper(
          previous[id],
          snapshot[id],
        ),
    );

    const updated =
      await this.prisma.examTimetable.update(
        {
          where: {
            id: timetable.id,
          },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
            publishedVersion: {
              increment: 1,
            },
            publishedSnapshot:
              snapshot as unknown as Prisma.InputJsonValue,
          },
        },
      );

    // Work out who to tell, and what changed for each of them.
    const enrolled =
      await this.enrolment(
        view.semester.id,
      );

    const perStudent = new Map<
      string,
      string[]
    >();

    for (
      const offeringId of firstTime
        ? Object.keys(snapshot)
        : changed
    ) {
      for (const studentId of
        enrolled.get(offeringId) ??
        []) {
        if (
          !perStudent.has(studentId)
        ) {
          perStudent.set(
            studentId,
            [],
          );
        }

        const now =
          snapshot[offeringId];

        const before =
          previous[offeringId];

        const line = !now
          ? `${before?.courseCode} is no longer on the timetable.`
          : `${now.courseCode}: ${fmt(
              now.startsAt,
            )}, ${
              now.venue ??
              'venue to be announced'
            }.`;

        perStudent
          .get(studentId)!
          .push(line);
      }
    }

    await this.notifications.notify({
      eventKey:
        EVENT_KEYS.EXAM_TIMETABLE_PUBLISHED,

      recipients: [
        ...perStudent,
      ].map(
        ([userId, lines]) => ({
          userId,
          vars: {
            changeSummary: firstTime
              ? ''
              : `\n\nChanges to your papers:\n${lines.join(
                  '\n',
                )}`,
          },
        }),
      ),

      channels: [
        'IN_APP',
        'EMAIL',
        'SMS',
      ],

      sharedVars: {
        semesterLabel:
          view.semester.label,
        action: firstTime
          ? 'published'
          : 'updated',
      },

      link: '/exams',
    });

    await this.audit.record({
      action: firstTime
        ? 'exams.timetable_published'
        : 'exams.timetable_republished',
      module: 'exams',
      targetType: 'ExamTimetable',
      targetId: timetable.id,
      metadata: {
        version:
          updated.publishedVersion,
        papers: sessions.length,
        changedPapers:
          changed.length,
        studentsNotified:
          perStudent.size,
      },
    });

    return {
      ...(await this.overview(
        view.semester.id,
      )),
      notified:
        perStudent.size,
    };
  }

  /** Staff who can invigilate. */
  invigilatorOptions() {
    return this.prisma.user.findMany({
      where: {
        type: 'STAFF',
        status: 'ACTIVE',
      },
      orderBy: [
        {
          lastName: 'asc',
        },
        {
          firstName: 'asc',
        },
      ],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        staffProfile: {
          select: {
            department: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
  }

  private async ensure(
    semesterId: string,
  ) {
    return this.prisma.examTimetable.upsert(
      {
        where: {
          semesterId,
        },
        create: {
          semesterId,
        },
        update: {},
      },
    );
  }
}