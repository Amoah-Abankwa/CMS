import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ROLE_KEYS, scopeValue } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { OfferingsService } from '../offerings/offerings.service';
import { GradingService } from './grading.service';
import {
  computeTotal,
  gradeFor,
  INCOMPLETE_GRADE,
  weightsProblem,
  type Mark,
} from './grading';
import { ComponentDto, MarkEntryDto } from './dto/results.dto';

export const SUGGESTED_SCHEME: Array<Omit<ComponentDto, 'id'>> = [
  {
    name: 'Mid-semester test',
    kind: 'CONTINUOUS',
    weight: 20,
    maxScore: 50,
  },
  {
    name: 'Assignments',
    kind: 'CONTINUOUS',
    weight: 10,
    maxScore: 20,
  },
  {
    name: 'Quizzes',
    kind: 'CONTINUOUS',
    weight: 10,
    maxScore: 20,
  },
  {
    name: 'End of semester examination',
    kind: 'EXAM',
    weight: 60,
    maxScore: 100,
  },
];

export const DEVOTION_RULE_KEY = 'results.devotion';
export const DEVOTION_SHARE = 5;

const courseTotalWithDevotion = (
  total: number,
  devotion: { score: number } | { exempt: true },
): number => {
  if ('exempt' in devotion) {
    return (total / (100 - DEVOTION_SHARE)) * 100;
  }

  return total + devotion.score;
};

const EDITABLE: string[] = ['DRAFT'];

@Injectable()
export class MarksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly offerings: OfferingsService,
    private readonly grading: GradingService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async workbook(user: AuthUser, offeringId: string) {
    const { offering, isLead } = await this.access(user, offeringId);

    const [students, assessments, sheet, scale] = await Promise.all([
      this.offerings.roster(offeringId),
      this.assessments(offeringId),
      this.prisma.resultSheet.findUnique({
        where: { offeringId },
        select: {
          status: true,
          returnNote: true,
          returnedAt: true,
          submittedAt: true,
          publishedAt: true,
        },
      }),
      this.grading.active().catch(() => null),
    ]);

    const marks = await this.prisma.assessmentMark.findMany({
      where: {
        assessmentId: {
          in: assessments.map((a) => a.id),
        },
      },
      select: {
        assessmentId: true,
        studentId: true,
        score: true,
        absent: true,
      },
    });

    const status = sheet?.status ?? 'DRAFT';
    const devotionInTotals = await this.devotionInTotals();

    return {
      offering: {
        id: offering.id,
        course: offering.course,
        semesterLabel: `${offering.semester.academicYear.label}, Semester ${offering.semester.number}`,
      },
      isLead,
      canEdit: EDITABLE.includes(status),
      sheet: {
        status,
        returnNote: sheet?.returnNote ?? null,
        returnedAt: sheet?.returnedAt ?? null,
        submittedAt: sheet?.submittedAt ?? null,
        publishedAt: sheet?.publishedAt ?? null,
      },
      assessments,
      suggestedScheme: assessments.length
        ? null
        : devotionInTotals
          ? SUGGESTED_SCHEME.map((component) =>
              component.kind === 'EXAM'
                ? {
                    ...component,
                    weight: component.weight - DEVOTION_SHARE,
                  }
                : component,
            )
          : SUGGESTED_SCHEME,
      devotionInTotals,
      students,
      marks,
      scale,
    };
  }

  async saveScheme(
    user: AuthUser,
    offeringId: string,
    components: ComponentDto[],
  ) {
    await this.access(user, offeringId, {
      lead: true,
      editable: true,
    });

    const names = components.map((component) =>
      component.name.trim().toLowerCase(),
    );

    if (new Set(names).size !== names.length) {
      throw new BadRequestException({
        code: 'DUPLICATE_NAME',
        message: 'Each assessment needs a different name.',
      });
    }

    const problem = weightsProblem(
      components.map((component, index) => ({
        id: component.id ?? String(index),
        kind: component.kind,
        weight: component.weight,
        maxScore: component.maxScore,
      })),
    );

    if (problem) {
      throw new BadRequestException({
        code: 'WEIGHTS',
        message: problem,
      });
    }

    const existing = await this.prisma.assessment.findMany({
      where: { offeringId },
      select: {
        id: true,
        name: true,
        maxScore: true,
        _count: {
          select: {
            marks: {
              where: {
                OR: [
                  { score: { not: null } },
                  { absent: true },
                ],
              },
            },
          },
        },
      },
    });

    const keep = new Set(
      components
        .filter((component) => component.id)
        .map((component) => component.id!),
    );

    const unknown = [...keep].filter(
      (id) => !existing.some((assessment) => assessment.id === id),
    );

    if (unknown.length) {
      throw new BadRequestException({
        code: 'UNKNOWN_ASSESSMENT',
        message: 'The page is out of date. Refresh and try again.',
      });
    }

    const removed = existing.filter(
      (assessment) => !keep.has(assessment.id),
    );

    const withMarks = removed.find(
      (assessment) => assessment._count.marks > 0,
    );

    if (withMarks) {
      throw new ConflictException({
        code: 'HAS_MARKS',
        message: `"${withMarks.name}" already has marks. Clear them before removing it.`,
      });
    }

    for (const component of components.filter(
      (item) => item.id,
    )) {
      const highest = await this.prisma.assessmentMark.aggregate({
        where: {
          assessmentId: component.id,
        },
        _max: {
          score: true,
        },
      });

      if ((highest._max.score ?? 0) > component.maxScore) {
        throw new ConflictException({
          code: 'MAX_TOO_LOW',
          message: `"${component.name}" has a mark of ${highest._max.score}. It cannot be marked out of less than that.`,
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (removed.length) {
        await tx.assessment.deleteMany({
          where: {
            id: {
              in: removed.map((assessment) => assessment.id),
            },
          },
        });
      }

      for (const [position, component] of components.entries()) {
        const data = {
          name: component.name.trim(),
          kind: component.kind,
          weight: component.weight,
          maxScore: component.maxScore,
          position,
        };

        if (component.id) {
          await tx.assessment.update({
            where: {
              id: component.id,
            },
            data,
          });
        } else {
          await tx.assessment.create({
            data: {
              ...data,
              offeringId,
            },
          });
        }
      }
    });

    await this.audit.record({
      action: 'marks.scheme_saved',
      module: 'results',
      targetType: 'CourseOffering',
      targetId: offeringId,
      after: components,
    });

    return this.workbook(user, offeringId);
  }

  async saveMarks(
    user: AuthUser,
    offeringId: string,
    entries: MarkEntryDto[],
  ) {
    await this.access(user, offeringId, {
      editable: true,
    });

    const [assessments, roster] = await Promise.all([
      this.assessments(offeringId),
      this.offerings.roster(offeringId),
    ]);

    const byId = new Map(
      assessments.map((assessment) => [
        assessment.id,
        assessment,
      ]),
    );

    const onRoster = new Set(
      roster.map((student) => student.id),
    );

    for (const entry of entries) {
      const assessment = byId.get(entry.assessmentId);

      if (!assessment || !onRoster.has(entry.studentId)) {
        throw new BadRequestException({
          code: 'STALE',
          message: 'The page is out of date. Refresh and try again.',
        });
      }

      if (
        entry.score !== null &&
        entry.score > assessment.maxScore
      ) {
        throw new BadRequestException({
          code: 'SCORE_TOO_HIGH',
          message: `A mark of ${entry.score} is higher than the maximum of ${assessment.maxScore} for "${assessment.name}".`,
        });
      }
    }

    const now = new Date();

    await this.prisma.$transaction([
      ...entries.map((entry) => {
        const data = {
          score: entry.absent ? null : entry.score,
          absent: entry.absent,
          enteredById: user.id,
        };

        return this.prisma.assessmentMark.upsert({
          where: {
            assessmentId_studentId: {
              assessmentId: entry.assessmentId,
              studentId: entry.studentId,
            },
          },
          create: {
            assessmentId: entry.assessmentId,
            studentId: entry.studentId,
            ...data,
          },
          update: data,
        });
      }),
      this.prisma.assessment.updateMany({
        where: {
          id: {
            in: [
              ...new Set(
                entries.map((entry) => entry.assessmentId),
              ),
            ],
          },
        },
        data: {
          marksUpdatedAt: now,
        },
      }),
    ]);

    await this.audit.record({
      action: 'marks.saved',
      module: 'results',
      targetType: 'CourseOffering',
      targetId: offeringId,
      metadata: {
        entries: entries.length,
        assessments: [
          ...new Set(
            entries.map(
              (entry) =>
                byId.get(entry.assessmentId)!.name,
            ),
          ),
        ],
      },
    });

    return this.workbook(user, offeringId);
  }

  async release(
    user: AuthUser,
    offeringId: string,
    assessmentId: string,
  ) {
    const { offering } = await this.access(user, offeringId, {
      lead: true,
    });

    const assessment =
      await this.prisma.assessment.findFirst({
        where: {
          id: assessmentId,
          offeringId,
        },
      });

    if (!assessment) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Assessment not found.',
      });
    }

    if (assessment.kind !== 'CONTINUOUS') {
      throw new BadRequestException({
        code: 'EXAM_NOT_SHAREABLE',
        message:
          'Exam marks reach students only when results are published.',
      });
    }

    if (!assessment.marksUpdatedAt) {
      throw new BadRequestException({
        code: 'NO_MARKS',
        message: 'Enter marks before sharing them.',
      });
    }

    if (
      assessment.releasedAt &&
      assessment.marksUpdatedAt <= assessment.releasedAt
    ) {
      throw new ConflictException({
        code: 'NOTHING_NEW',
        message:
          'Students already have the latest marks for this assessment.',
      });
    }

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.$executeRaw`
        UPDATE "AssessmentMark"
        SET "releasedScore" = "score",
            "releasedAbsent" = "absent",
            "releasedAt" = ${now}
        WHERE "assessmentId" = ${assessmentId}::uuid
          AND ("score" IS NOT NULL OR "absent" = true)
      `,
      this.prisma.assessment.update({
        where: {
          id: assessmentId,
        },
        data: {
          releasedAt: now,
        },
      }),
    ]);

    const recipients =
      await this.prisma.assessmentMark.findMany({
        where: {
          assessmentId,
          releasedAt: now,
        },
        select: {
          studentId: true,
        },
      });

    await this.notifications.notify({
      eventKey: EVENT_KEYS.INTERNALS_UPDATED,
      recipients: recipients.map((recipient) => ({
        userId: recipient.studentId,
      })),
      channels: ['IN_APP', 'EMAIL', 'SMS'],
      sharedVars: {
        courseCode: offering.course.code,
        assessmentName: assessment.name,
      },
      link: '/results',
    });

    await this.audit.record({
      action: 'marks.shared',
      module: 'results',
      targetType: 'Assessment',
      targetId: assessmentId,
      metadata: {
        course: offering.course.code,
        students: recipients.length,
      },
    });

    return this.workbook(user, offeringId);
  }

  private async devotionInTotals(): Promise<boolean> {
    const row =
      await this.prisma.systemSetting.findUnique({
        where: {
          key: DEVOTION_RULE_KEY,
        },
      });

    const value = row?.value as {
      inTotals?: boolean;
    } | null;

    return value?.inTotals ?? true;
  }

  async submit(
    user: AuthUser,
    offeringId: string,
  ) {
    const { offering } = await this.access(user, offeringId, {
      lead: true,
      editable: true,
    });

    const [assessments, roster, scale] =
      await Promise.all([
        this.assessments(offeringId),
        this.offerings.roster(offeringId),
        this.grading.active(),
      ]);

    const withDevotion =
      await this.devotionInTotals();

    const problem = weightsProblem(assessments);

    if (problem) {
      throw new BadRequestException({
        code: 'WEIGHTS',
        message: problem,
      });
    }

    if (roster.length === 0) {
      throw new BadRequestException({
        code: 'NO_STUDENTS',
        message:
          'There are no approved students in this course.',
      });
    }

    const marks =
      await this.prisma.assessmentMark.findMany({
        where: {
          assessmentId: {
            in: assessments.map(
              (assessment) => assessment.id,
            ),
          },
        },
      });

    const byStudent = new Map<
      string,
      Map<string, Mark>
    >();

    for (const mark of marks) {
      if (!byStudent.has(mark.studentId)) {
        byStudent.set(mark.studentId, new Map());
      }

      byStudent
        .get(mark.studentId)!
        .set(mark.assessmentId, {
          score: mark.score,
          absent: mark.absent,
        });
    }

    const rows = roster.map((student) => ({
      student,
      ...computeTotal(
        assessments,
        byStudent.get(student.id) ?? new Map(),
      ),
    }));

    const incompleteEntry = rows.filter(
      (row) => row.missing > 0,
    );

    if (incompleteEntry.length) {
      throw new BadRequestException({
        code: 'MARKS_MISSING',
        message: `${incompleteEntry.length} student${
          incompleteEntry.length === 1
            ? ' is'
            : 's are'
        } missing marks, for example ${
          incompleteEntry[0].student.indexNumber
        }. Enter a mark or type ABS for absent.`,
      });
    }

    const devotionOf = new Map<
      string,
      { score: number } | { exempt: true }
    >();

    if (withDevotion) {
      const ids = rows.map(
        (row) => row.student.id,
      );

      const [
        profiles,
        finalised,
        exempted,
      ] = await Promise.all([
        this.prisma.studentProfile.findMany({
          where: {
            userId: {
              in: ids,
            },
          },
          select: {
            userId: true,
            programme: {
              select: {
                level: {
                  select: {
                    mode: true,
                  },
                },
              },
            },
          },
        }),

        this.prisma.devotionResult.findMany({
          where: {
            semesterId: offering.semesterId,
            studentId: {
              in: ids,
            },
          },
          select: {
            studentId: true,
            score: true,
          },
        }),

        this.prisma.devotionExemption.findMany({
          where: {
            semesterId: offering.semesterId,
            studentId: {
              in: ids,
            },
          },
          select: {
            studentId: true,
          },
        }),
      ]);

      const weekend = new Set([
        ...profiles
          .filter(
            (profile) =>
              profile.programme.level.mode ===
              'WEEKEND',
          )
          .map((profile) => profile.userId),
        ...exempted.map(
          (item) => item.studentId,
        ),
      ]);

      const score = new Map(
        finalised.map((item) => [
          item.studentId,
          item.score,
        ]),
      );

      const missing = ids.filter(
        (id) =>
          !weekend.has(id) &&
          !score.has(id),
      );

      if (missing.length) {
        const example = rows.find(
          (row) =>
            row.student.id === missing[0],
        )!.student.indexNumber;

        throw new BadRequestException({
          code: 'DEVOTION_NOT_FINAL',
          message: `Morning devotion scores are not finalised for ${missing.length} student${
            missing.length === 1 ? '' : 's'
          } (for example ${example}). The Chaplaincy finalises them under Devotion scores; then submit again.`,
        });
      }

      for (const id of ids) {
        devotionOf.set(
          id,
          weekend.has(id)
            ? { exempt: true }
            : {
                score: score.get(id)!,
              },
        );
      }
    }

    for (const row of rows) {
      const devotion =
        devotionOf.get(row.student.id);

      if (devotion && !row.incomplete) {
        row.total = courseTotalWithDevotion(
          row.caScore + row.examScore,
          devotion,
        );
      }
    }

    const credits =
      offering.course.creditHours;

    await this.prisma.$transaction(
      async (tx) => {
        const sheet =
          await tx.resultSheet.upsert({
            where: {
              offeringId,
            },
            create: {
              offeringId,
              status: 'SUBMITTED',
              scaleId: scale.id,
              submittedAt: new Date(),
              submittedById: user.id,
            },
            update: {
              status: 'SUBMITTED',
              scaleId: scale.id,
              submittedAt: new Date(),
              submittedById: user.id,
              hodApprovedAt: null,
              hodApprovedById: null,
              deanApprovedAt: null,
              deanApprovedById: null,
              returnNote: null,
              returnedAt: null,
              returnedById: null,
            },
          });

        await tx.courseResult.deleteMany({
          where: {
            sheetId: sheet.id,
          },
        });

        await tx.courseResult.createMany({
          data: rows.map((row) => {
            const band = gradeFor(
              row.total,
              scale.bands,
            );

            const devotion =
              devotionOf.get(
                row.student.id,
              );

            return {
              sheetId: sheet.id,
              studentId: row.student.id,
              credits,
              caScore: row.caScore,
              examScore: row.examScore,
              total: row.total,
              grade: row.incomplete
                ? INCOMPLETE_GRADE
                : band.letter,
              gradePoint: row.incomplete
                ? 0
                : band.gradePoint,
              isPass: row.incomplete
                ? false
                : band.isPass,
              incomplete: row.incomplete,
              devotionScore:
                devotion &&
                'score' in devotion
                  ? devotion.score
                  : null,
              devotionExempt:
                !!devotion &&
                'exempt' in devotion,
            };
          }),
        });
      },
    );

    await this.audit.record({
      action: 'results.submitted',
      module: 'results',
      targetType: 'CourseOffering',
      targetId: offeringId,
      metadata: {
        course: offering.course.code,
        students: rows.length,
        scaleVersion: scale.version,
      },
    });

    await this.notifyRole(
      ROLE_KEYS.HEAD_OF_DEPARTMENT,
      scopeValue(
        'department',
        offering.course.department.id,
      ),
      offering,
      'approval as Head of Department',
    );

    return this.workbook(
      user,
      offeringId,
    );
  }

  async notifyRole(
    roleKey: string,
    scope: string | null,
    offering: {
      course: {
        code: string;
        title: string;
      };
      semester: {
        number: number;
        academicYear: {
          label: string;
        };
      };
    },
    stage: string,
  ): Promise<void> {
    const holders =
      await this.prisma.userRole.findMany({
        where: {
          role: {
            key: roleKey,
          },
          scope,
          user: {
            status: 'ACTIVE',
          },
        },
        select: {
          userId: true,
        },
      });

    if (!holders.length) {
      return;
    }

    await this.notifications.notify({
      eventKey:
        EVENT_KEYS.RESULTS_AWAITING_APPROVAL,
      recipients: holders.map((holder) => ({
        userId: holder.userId,
      })),
      channels: ['IN_APP', 'EMAIL'],
      sharedVars: {
        courseCode: offering.course.code,
        courseTitle: offering.course.title,
        semesterLabel: `${offering.semester.academicYear.label}, Semester ${offering.semester.number}`,
        stage,
      },
      link: '/academics/results',
    });
  }

  private assessments(offeringId: string) {
    return this.prisma.assessment.findMany({
      where: {
        offeringId,
      },
      orderBy: {
        position: 'asc',
      },
      select: {
        id: true,
        name: true,
        kind: true,
        weight: true,
        maxScore: true,
        position: true,
        releasedAt: true,
        marksUpdatedAt: true,
      },
    });
  }

  private async access(
    user: AuthUser,
    offeringId: string,
    need: {
      lead?: boolean;
      editable?: boolean;
    } = {},
  ) {
    const offering =
      await this.prisma.courseOffering.findUnique({
        where: {
          id: offeringId,
        },
        select: {
          id: true,
          semesterId: true,
          course: {
            select: {
              code: true,
              title: true,
              creditHours: true,
              department: {
                select: {
                  id: true,
                  schoolId: true,
                },
              },
            },
          },
          semester: {
            select: {
              number: true,
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
              isLead: true,
            },
          },
          resultSheet: {
            select: {
              status: true,
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

    const assignment =
      offering.lecturers[0];

    if (!assignment) {
      throw new ForbiddenException({
        code: 'NOT_YOUR_CLASS',
        message:
          'You are not assigned to teach this course.',
      });
    }

    if (
      need.lead &&
      !assignment.isLead
    ) {
      throw new ForbiddenException({
        code: 'LEAD_ONLY',
        message:
          'Only the lead lecturer can do this.',
      });
    }

    const status =
      offering.resultSheet?.status ??
      'DRAFT';

    if (
      need.editable &&
      !EDITABLE.includes(status)
    ) {
      throw new ConflictException({
        code: 'SHEET_LOCKED',
        message:
          status === 'PUBLISHED'
            ? 'Results for this course are published and can no longer be changed.'
            : 'Results are with the approvers. They must return them before marks can change.',
      });
    }

    return {
      offering,
      isLead: assignment.isLead,
    };
  }
}