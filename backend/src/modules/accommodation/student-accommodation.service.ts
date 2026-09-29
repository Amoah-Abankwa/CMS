import { UploadsService } from '../uploads/uploads.service';
import { HostelFeesService } from './hostel-fees.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { AllocationService, toGender } from './allocation.service';
import {
  ApplicationDto,
  BookingRequestDto,
  ResidenceDto,
} from './dto/accommodation.dto';

const MAX_OPEN_REQUESTS = 3;

@Injectable()
export class StudentAccommodationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly allocation: AllocationService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly hostelFees: HostelFeesService,
    private readonly uploads: UploadsService,
  ) {}

  /** Everything the student's accommodation page needs. */
  async overview(user: AuthUser) {
    this.assertStudent(user);

    const { semester, round, open } = await this.allocation.round();

    const [
      profile,
      application,
      allocation,
      bookings,
      declaration,
      halls,
    ] = await Promise.all([
      this.prisma.studentProfile.findUnique({
        where: { userId: user.id },
        select: { gender: true },
      }),

      this.prisma.hostelApplication.findUnique({
        where: {
          semesterId_studentId: {
            semesterId: semester.id,
            studentId: user.id,
          },
        },
      }),

      this.prisma.roomAllocation.findFirst({
        where: {
          studentId: user.id,
          semesterId: semester.id,
          status: { in: ['OFFERED', 'ACCEPTED'] },
        },
        select: {
          id: true,
          status: true,
          acceptBy: true,
          offeredAt: true,
          room: {
            select: {
              number: true,
              roomType: true,
              pricePerSemester: true,
              floor: true,
              hostel: {
                select: {
                  name: true,
                  location: true,
                },
              },
            },
          },
        },
      }),

      this.prisma.privateBooking.findMany({
        where: {
          studentId: user.id,
          semesterId: semester.id,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          message: true,
          ownerNote: true,
          createdAt: true,
          respondedAt: true,
          roomType: {
            select: {
              name: true,
              pricePerSemester: true,
              hostel: {
                select: {
                  name: true,
                  location: true,
                  contactPhone: true,
                },
              },
            },
          },
        },
      }),

      this.prisma.residenceDeclaration.findUnique({
        where: {
          studentId_semesterId: {
            studentId: user.id,
            semesterId: semester.id,
          },
        },
      }),

      this.prisma.hostel.findMany({
        where: {
          kind: 'UNIVERSITY',
          isActive: true,
        },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          gender: true,
          location: true,
          facilities: true,
          rooms: {
            where: { isActive: true },
            select: {
              roomType: true,
              pricePerSemester: true,
            },
          },
        },
      }),
    ]);

    const gender = toGender(profile?.gender);

    return {
      semester: {
        id: semester.id,
        label: semester.label,
      },

      round: round
        ? {
            opensAt: round.opensAt,
            closesAt: round.closesAt,
            acceptanceDays: round.acceptanceDays,
          }
        : null,

      applicationsOpen: open,
      gender,
      application,
      allocation,
      bookings,
      declaration,

      hostels: halls
        .filter((h) => !gender || h.gender === gender)
        .map(({ rooms, ...h }) => ({
          ...h,
          roomTypes: [
            ...new Map(
              rooms.map((r) => [
                r.roomType,
                {
                  roomType: r.roomType,
                  pricePerSemester: r.pricePerSemester,
                },
              ]),
            ).values(),
          ],
        })),

      residence:
        allocation?.status === 'ACCEPTED'
          ? {
              kind: 'UNIVERSITY',
              label: `${allocation.room.hostel.name}, room ${allocation.room.number}`,
            }
          : bookings.find((b) => b.status === 'ACCEPTED')
            ? {
                kind: 'PRIVATE',
                label: bookings.find((b) => b.status === 'ACCEPTED')!.roomType
                  .hostel.name,
              }
            : declaration
              ? {
                  kind: 'OFF_CAMPUS',
                  label: declaration.address,
                }
              : {
                  kind: 'UNKNOWN',
                  label: null,
                },
    };
  }

  async apply(user: AuthUser, dto: ApplicationDto) {
    this.assertStudent(user);

    const { semester, open } = await this.allocation.round();

    if (!open) {
      throw new ForbiddenException({
        code: 'CLOSED',
        message: 'Hostel applications are not open right now.',
      });
    }

    const existing = await this.prisma.hostelApplication.findUnique({
      where: {
        semesterId_studentId: {
          semesterId: semester.id,
          studentId: user.id,
        },
      },
    });

    if (
      existing &&
      existing.status !== 'SUBMITTED' &&
      existing.status !== 'WITHDRAWN'
    ) {
      throw new ConflictException({
        code: 'LOCKED',
        message:
          existing.status === 'ALLOCATED'
            ? 'You already have a hostel offer. Respond to it instead.'
            : 'Allocation has run. Contact the Hostel Office to change your choices.',
      });
    }

    if (!dto.preferences.length && !dto.acceptAny) {
      throw new BadRequestException({
        code: 'NO_CHOICE',
        message:
          'Choose at least one hostel, or accept any hostel.',
      });
    }

    const ids = dto.preferences.map((p) => p.hostelId);

    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException({
        code: 'DUPLICATE',
        message: 'Choose each hostel only once.',
      });
    }

    const profile = await this.prisma.studentProfile.findUniqueOrThrow({
      where: { userId: user.id },
      select: {
        id: true,
        gender: true,
      },
    });

    let gender = toGender(profile.gender);

    if (!gender) {
      if (!dto.gender) {
        throw new BadRequestException({
          code: 'GENDER_REQUIRED',
          message:
            'University hostels are single-gender. Tell us which halls you can be placed in.',
        });
      }

      await this.prisma.studentProfile.update({
        where: { id: profile.id },
        data: { gender: dto.gender },
      });

      gender = toGender(dto.gender);
    }

    const halls = await this.prisma.hostel.findMany({
      where: {
        id: { in: ids },
        kind: 'UNIVERSITY',
        isActive: true,
      },
      select: {
        id: true,
        gender: true,
        name: true,
      },
    });

    if (halls.length !== ids.length) {
      throw new BadRequestException({
        code: 'HOSTEL_INVALID',
        message:
          'One of the hostels is not available. Refresh the page.',
      });
    }

    const wrong = halls.find((h) => h.gender !== gender);

    if (wrong) {
      throw new BadRequestException({
        code: 'WRONG_HOSTEL',
        message: `${wrong.name} is not for ${
          gender === 'FEMALE' ? 'female' : 'male'
        } students.`,
      });
    }

    const data = {
      preferences: dto.preferences.map((p) => ({
        hostelId: p.hostelId,
        roomType: p.roomType || null,
      })),
      acceptAny: dto.acceptAny,
      specialNeeds: dto.specialNeeds || null,

      ...(existing &&
      (existing.specialNeeds ?? null) !== (dto.specialNeeds || null)
        ? { specialNeedsApproved: false }
        : {}),

      status: 'SUBMITTED' as const,
      roommateIndex: dto.roommateIndex || null,
    };

    if (dto.roommateIndex) {
      const currentStudent = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { indexNumber: true },
      });

      if (
        currentStudent?.indexNumber &&
        dto.roommateIndex === currentStudent.indexNumber
      ) {
        throw new BadRequestException({
          code: 'SELF',
          message: 'Name someone else as your roommate.',
        });
      }

      const mate = await this.prisma.user.count({
        where: {
          indexNumber: dto.roommateIndex,
          type: 'STUDENT',
          status: 'ACTIVE',
        },
      });

      if (!mate) {
        throw new BadRequestException({
          code: 'ROOMMATE',
          message:
            'No active student has that index number.',
        });
      }
    }

    const app = await this.prisma.hostelApplication.upsert({
      where: {
        semesterId_studentId: {
          semesterId: semester.id,
          studentId: user.id,
        },
      },
      create: {
        semesterId: semester.id,
        studentId: user.id,
        ...data,
      },
      update:
        existing?.status === 'WITHDRAWN'
          ? {
              ...data,
              submittedAt: new Date(),
            }
          : data,
    });

    await this.audit.record({
      action: existing
        ? 'accommodation.application_updated'
        : 'accommodation.applied',
      module: 'accommodation',
      targetType: 'HostelApplication',
      targetId: app.id,
    });

    return app;
  }

  async withdraw(user: AuthUser) {
    this.assertStudent(user);

    const { semester } = await this.allocation.round();

    const r = await this.prisma.hostelApplication.updateMany({
      where: {
        semesterId: semester.id,
        studentId: user.id,
        status: {
          in: ['SUBMITTED', 'UNPLACED'],
        },
      },
      data: {
        status: 'WITHDRAWN',
      },
    });

    if (!r.count) {
      throw new ConflictException({
        code: 'NOTHING',
        message:
          'There is no waiting application to withdraw.',
      });
    }

    await this.prisma.roomAllocation.deleteMany({
      where: {
        semesterId: semester.id,
        studentId: user.id,
        status: 'PROVISIONAL',
      },
    });

    await this.audit.record({
      action: 'accommodation.application_withdrawn',
      module: 'accommodation',
    });

    return { ok: true };
  }

  async respond(user: AuthUser, accept: boolean) {
    this.assertStudent(user);

    const { semester } = await this.allocation.round();

    const offer = await this.prisma.roomAllocation.findFirst({
      where: {
        studentId: user.id,
        semesterId: semester.id,
        status: 'OFFERED',
      },
    });

    if (!offer) {
      throw new NotFoundException({
        code: 'NO_OFFER',
        message:
          'You have no hostel offer waiting for a reply.',
      });
    }

    if (offer.acceptBy && offer.acceptBy < new Date()) {
      throw new ConflictException({
        code: 'EXPIRED',
        message: 'This offer has expired.',
      });
    }

    if (accept) {
      const privateBed =
        await this.prisma.privateBooking.findFirst({
          where: {
            studentId: user.id,
            semesterId: semester.id,
            status: 'ACCEPTED',
          },
        });

      if (privateBed) {
        throw new ConflictException({
          code: 'HAS_PRIVATE',
          message:
            'You have a confirmed private hostel booking. Cancel it before accepting a university room.',
        });
      }
    }

    await this.prisma.roomAllocation.update({
      where: { id: offer.id },
      data: {
        status: accept ? 'ACCEPTED' : 'DECLINED',
        respondedAt: new Date(),
      },
    });

    if (accept) {
      await this.hostelFees.syncAllocation(
        offer.id,
        user.id,
      );
    }

    if (!accept) {
      await this.prisma.hostelApplication.updateMany({
        where: {
          semesterId: semester.id,
          studentId: user.id,
        },
        data: {
          status: 'WITHDRAWN',
        },
      });
    }

    await this.audit.record({
      action: accept
        ? 'accommodation.offer_accepted'
        : 'accommodation.offer_declined',
      module: 'accommodation',
      targetType: 'RoomAllocation',
      targetId: offer.id,
    });

    return this.overview(user);
  }

  /** Verified private hostels with their room types. */
  async privateHostels(user: AuthUser) {
    this.assertStudent(user);

    const hostels = await this.prisma.hostel.findMany({
      where: {
        kind: 'PRIVATE',
        isActive: true,
        verification: 'APPROVED',
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        gender: true,
        location: true,
        digitalAddress: true,
        distanceNote: true,
        description: true,
        facilities: true,
        contactPhone: true,
        photoIds: true,
        roomTypes: {
          where: { isActive: true },
          orderBy: { pricePerSemester: 'asc' },
          select: {
            id: true,
            name: true,
            bedsPerRoom: true,
            pricePerSemester: true,
            availableBeds: true,
            description: true,
          },
        },
      },
    });

    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: { gender: true },
    });

    const gender = toGender(profile?.gender);

    return hostels
      .filter(
        (h) =>
          h.gender === 'MIXED' ||
          !gender ||
          h.gender === gender,
      )
      .map(({ photoIds, ...h }) => ({
        ...h,
        photoUrls: photoIds
          .map((p) => this.uploads.url(p, 900))
          .filter(Boolean),
      }));
  }

  async requestBooking(
    user: AuthUser,
    dto: BookingRequestDto,
  ) {
    this.assertStudent(user);

    const { semester } = await this.allocation.round();

    const roomType =
      await this.prisma.privateRoomType.findUnique({
        where: { id: dto.roomTypeId },
        include: {
          hostel: {
            select: {
              id: true,
              name: true,
              gender: true,
              ownerId: true,
              verification: true,
              isActive: true,
            },
          },
        },
      });

    if (
      !roomType ||
      !roomType.isActive ||
      roomType.hostel.verification !== 'APPROVED' ||
      !roomType.hostel.isActive
    ) {
      throw new NotFoundException({
        code: 'NOT_AVAILABLE',
        message: 'That room is no longer listed.',
      });
    }

    if (roomType.availableBeds < 1) {
      throw new ConflictException({
        code: 'FULL',
        message: `${roomType.name} at ${roomType.hostel.name} is full.`,
      });
    }

    const [
      confirmedPrivate,
      universityPlace,
      open,
    ] = await Promise.all([
      this.prisma.privateBooking.findFirst({
        where: {
          studentId: user.id,
          semesterId: semester.id,
          status: 'ACCEPTED',
        },
      }),

      this.prisma.roomAllocation.findFirst({
        where: {
          studentId: user.id,
          semesterId: semester.id,
          status: 'ACCEPTED',
        },
      }),

      this.prisma.privateBooking.findMany({
        where: {
          studentId: user.id,
          semesterId: semester.id,
          status: 'REQUESTED',
        },
        select: { roomTypeId: true },
      }),
    ]);

    if (confirmedPrivate) {
      throw new ConflictException({
        code: 'HAS_PRIVATE',
        message:
          'You already have a confirmed private hostel booking this semester.',
      });
    }

    if (universityPlace) {
      throw new ConflictException({
        code: 'HAS_UNIVERSITY',
        message:
          'You have accepted a university hostel room this semester.',
      });
    }

    if (open.some((o) => o.roomTypeId === roomType.id)) {
      throw new ConflictException({
        code: 'DUPLICATE',
        message:
          'You have already asked for this room.',
      });
    }

    if (open.length >= MAX_OPEN_REQUESTS) {
      throw new ConflictException({
        code: 'TOO_MANY',
        message: `You can have at most ${MAX_OPEN_REQUESTS} requests waiting. Cancel one first.`,
      });
    }

    const booking =
      await this.prisma.privateBooking.create({
        data: {
          semesterId: semester.id,
          studentId: user.id,
          roomTypeId: roomType.id,
          message: dto.message || null,
        },
      });

    await this.audit.record({
      action: 'accommodation.private_requested',
      module: 'accommodation',
      targetType: 'PrivateBooking',
      targetId: booking.id,
      metadata: {
        hostel: roomType.hostel.name,
        roomType: roomType.name,
      },
    });

    if (roomType.hostel.ownerId) {
      await this.notifications.notify({
        eventKey: EVENT_KEYS.PRIVATE_BOOKING_REQUESTED,
        recipients: [
          {
            userId: roomType.hostel.ownerId,
          },
        ],
        channels: ['IN_APP', 'EMAIL', 'SMS'],
        sharedVars: {
          hostel: roomType.hostel.name,
          roomType: roomType.name,
          student: user.label,
          semesterLabel: semester.label,
          messageLine: dto.message
            ? `Message: ${dto.message}`
            : '',
        },
        link: '/my-hostel',
      });
    }

    return booking;
  }

  async cancelBooking(user: AuthUser, id: string) {
    this.assertStudent(user);

    const booking =
      await this.prisma.privateBooking.findFirst({
        where: {
          id,
          studentId: user.id,
        },
        include: {
          roomType: {
            include: {
              hostel: {
                select: {
                  name: true,
                  ownerId: true,
                },
              },
            },
          },
        },
      });

    if (
      !booking ||
      (booking.status !== 'REQUESTED' &&
        booking.status !== 'ACCEPTED')
    ) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Booking not found.',
      });
    }

    await this.prisma.$transaction([
      this.prisma.privateBooking.update({
        where: { id },
        data: { status: 'CANCELLED' },
      }),

      ...(booking.status === 'ACCEPTED'
        ? [
            this.prisma.privateRoomType.update({
              where: { id: booking.roomTypeId },
              data: {
                availableBeds: {
                  increment: 1,
                },
              },
            }),
          ]
        : []),
    ]);

    await this.audit.record({
      action: 'accommodation.private_cancelled',
      module: 'accommodation',
      targetType: 'PrivateBooking',
      targetId: id,
    });

    if (
      booking.status === 'ACCEPTED' &&
      booking.roomType.hostel.ownerId
    ) {
      await this.notifications.notify({
        eventKey: EVENT_KEYS.PRIVATE_BOOKING_CANCELLED,
        recipients: [
          {
            userId: booking.roomType.hostel.ownerId,
          },
        ],
        channels: ['IN_APP', 'EMAIL'],
        sharedVars: {
          hostel: booking.roomType.hostel.name,
          roomType: booking.roomType.name,
          student: user.label,
        },
        link: '/my-hostel',
      });
    }

    await this.hostelFees.syncBooking(id);

    return { ok: true };
  }

  /** For students living off campus, e.g. with family. */
  async declare(user: AuthUser, dto: ResidenceDto) {
    this.assertStudent(user);

    const { semester } = await this.allocation.round();

    const d =
      await this.prisma.residenceDeclaration.upsert({
        where: {
          studentId_semesterId: {
            studentId: user.id,
            semesterId: semester.id,
          },
        },
        create: {
          studentId: user.id,
          semesterId: semester.id,
          ...dto,
        },
        update: dto,
      });

    await this.audit.record({
      action: 'accommodation.residence_declared',
      module: 'accommodation',
    });

    return d;
  }

  private assertStudent(user: AuthUser) {
    if (user.type !== 'STUDENT') {
      throw new ForbiddenException({
        code: 'STUDENTS_ONLY',
        message: 'This is for students.',
      });
    }
  }

  /** Whether the student's roommate request is matched: they named each other this semester. */
  async roommate(user: AuthUser) {
    this.assertStudent(user);

    const semester =
      await this.prisma.semester.findFirst({
        where: { isCurrent: true },
        select: { id: true },
      });

    const mine = semester
      ? await this.prisma.hostelApplication.findUnique({
          where: {
            semesterId_studentId: {
              semesterId: semester.id,
              studentId: user.id,
            },
          },
          select: {
            roommateIndex: true,
          },
        })
      : null;

    if (!mine?.roommateIndex || !semester) {
      return {
        roommateIndex: null,
        mutual: false,
      };
    }

    const theirs =
      await this.prisma.hostelApplication.findFirst({
        where: {
          semesterId: semester.id,
          student: {
            indexNumber: mine.roommateIndex,
          },
          status: {
            not: 'WITHDRAWN',
          },
        },
        select: {
          roommateIndex: true,
        },
      });

    const currentStudent =
      await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { indexNumber: true },
      });

    return {
      roommateIndex: mine.roommateIndex,
      mutual:
        theirs?.roommateIndex ===
        currentStudent?.indexNumber,
    };
  }
}