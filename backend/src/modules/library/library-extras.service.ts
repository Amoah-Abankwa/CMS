import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  illNext,
  ILL_STATUS_LABEL,
  libraryClearance,
  PERMISSIONS,
  readingShortfall,
  type IllStatus,
} from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PdfDoc } from '../../core/pdf/pdf';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { PermissionResolverService } from '../rbac/permission-resolver.service';
import { DocumentsService } from '../uploads/documents.service';

/**
 * Library services beyond the desk: graduation clearance, e-books, inter-library loans and course
 * reading lists.
 */
@Injectable()
export class LibraryExtrasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: PermissionResolverService,
    private readonly documents: DocumentsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private async perms(user: AuthUser) {
    return this.resolver.permissionsFor(user.id, user.activeRoleKey);
  }

  // ----- Graduation clearance -----

  private async standing(studentIds: string[]) {
    const [loans, ills, fines, certs] = await Promise.all([
      this.prisma.loan.groupBy({
        by: ['borrowerId'],
        where: {
          borrowerId: { in: studentIds },
          status: 'ACTIVE',
        },
        _count: true,
      }),
      this.prisma.interLibraryLoan.groupBy({
        by: ['requesterId'],
        where: {
          requesterId: { in: studentIds },
          status: { in: ['ARRIVED', 'ON_LOAN'] },
        },
        _count: true,
      }),
      this.prisma.libraryFine.findMany({
        where: {
          borrowerId: { in: studentIds },
          settledAt: null,
        },
        select: {
          borrowerId: true,
          amount: true,
          paid: true,
          waived: true,
        },
      }),
      this.prisma.libraryClearance.findMany({
        where: {
          studentId: { in: studentIds },
          revokedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          studentId: true,
          certificateNumber: true,
          createdAt: true,
        },
      }),
    ]);

    return new Map(
      studentIds.map((id) => {
        const owed = fines
          .filter((f) => f.borrowerId === id)
          .reduce(
            (t, f) => t + Math.max(0, f.amount - f.paid - f.waived),
            0,
          );

        const c = libraryClearance({
          booksOut: loans.find((l) => l.borrowerId === id)?._count ?? 0,
          interLibraryOut:
            ills.find((l) => l.requesterId === id)?._count ?? 0,
          finesOwed: owed,
        });

        return [
          id,
          {
            ...c,
            certificate: certs.find((x) => x.studentId === id) ?? null,
          },
        ];
      }),
    );
  }

  async myClearance(user: AuthUser) {
    return (await this.standing([user.id])).get(user.id)!;
  }

  /** The Registry or the library checks a graduation list: pasted index numbers. */
  async checkList(user: AuthUser, indexNumbers: string[]) {
    const perms = await this.perms(user);

    if (
      !perms.has(PERMISSIONS.LIBRARY_CIRCULATE) &&
      !perms.has(PERMISSIONS.ACADEMICS_MANAGE)
    ) {
      throw new ForbiddenException({
        code: 'NOT_ALLOWED',
        message: 'The library and the Registry check clearance.',
      });
    }

    const wanted = [
      ...new Set(
        indexNumbers.map((i) => i.trim().toUpperCase()).filter(Boolean),
      ),
    ].slice(0, 2000);

    const students = await this.prisma.user.findMany({
      where: {
        type: 'STUDENT',
        indexNumber: { in: wanted },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        indexNumber: true,
      },
    });

    const st = await this.standing(students.map((s) => s.id));
    const found = new Set(students.map((s) => s.indexNumber));

    return {
      rows: students.map((s) => ({
        student: s,
        ...st.get(s.id)!,
      })),
      notFound: wanted.filter((w) => !found.has(w)),
    };
  }

  async issueCertificate(
    user: AuthUser,
    indexNumber: string,
    note?: string,
  ) {
    const student = await this.prisma.user.findFirst({
      where: {
        indexNumber: indexNumber.toUpperCase(),
        type: 'STUDENT',
      },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'No student has that index number.',
      });
    }

    const s = (await this.standing([student.id])).get(student.id)!;

    if (!s.clear) {
      throw new ConflictException({
        code: 'NOT_CLEAR',
        message: s.reasons.join(' '),
      });
    }

    if (s.certificate) return s.certificate;

    const cert = await this.prisma.libraryClearance.create({
      data: {
        studentId: student.id,
        certificateNumber: `ANU-LC-${new Date().getUTCFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`,
        clearedById: user.id,
        note: note || null,
      },
    });

    await this.audit.record({
      action: 'library.clearance_issued',
      module: 'library',
      targetType: 'User',
      targetId: student.id,
      after: {
        certificate: cert.certificateNumber,
      },
    });

    return {
      certificateNumber: cert.certificateNumber,
      createdAt: cert.createdAt,
      studentId: student.id,
    };
  }

  async certificatePdf(user: AuthUser, certificateNumber: string) {
    const c = await this.prisma.libraryClearance.findUnique({
      where: { certificateNumber },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            indexNumber: true,
            studentProfile: {
              select: {
                programme: {
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

    if (!c) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Certificate not found.',
      });
    }

    const perms = await this.perms(user);

    if (
      c.student.id !== user.id &&
      !perms.has(PERMISSIONS.LIBRARY_CIRCULATE) &&
      !perms.has(PERMISSIONS.ACADEMICS_MANAGE)
    ) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Certificate not found.',
      });
    }

    const d = await PdfDoc.create(
      'Library clearance certificate',
      c.revokedAt
        ? `REVOKED: ${c.revokeReason ?? ''}`
        : 'For graduation',
    );

    d.rows([
      ['Certificate number', c.certificateNumber],
      [
        'Student',
        `${c.student.firstName} ${c.student.lastName} (${c.student.indexNumber ?? ''})`,
      ],
      [
        'Programme',
        c.student.studentProfile?.programme.name ?? '',
      ],
      ['Cleared on', c.createdAt.toISOString().slice(0, 10)],
      [
        'Status',
        'All library books returned and no fines owed on this date.',
      ],
    ]);

    return {
      filename: `library-clearance-${c.certificateNumber}.pdf`,
      buffer: await d.toBuffer(
        'University Library, All Nations University. Check a certificate at the library by its number.',
      ),
    };
  }

  // ----- E-books -----

  async setEbook(
    user: AuthUser,
    titleId: string,
    dto: {
      ebookUrl?: string | null;
      documentId?: string | null;
    },
  ) {
    const t = await this.prisma.libraryTitle.findUnique({
      where: { id: titleId },
    });

    if (!t) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Title not found.',
      });
    }

    if (dto.documentId) {
      const doc = await this.prisma.storedDocument.findUnique({
        where: { id: dto.documentId },
      });

      if (
        !doc ||
        doc.purpose !== 'EBOOK' ||
        !doc.publicId.includes(`/ebooks/${titleId}/`)
      ) {
        throw new BadRequestException({
          code: 'DOCUMENT',
          message: 'Upload the e-book for this title first.',
        });
      }
    }

    if (dto.ebookUrl && !/^https:\/\//.test(dto.ebookUrl)) {
      throw new BadRequestException({
        code: 'URL',
        message: 'Use the https:// link from the e-book platform.',
      });
    }

    await this.prisma.libraryTitle.update({
      where: { id: titleId },
      data: {
        ebookUrl: dto.ebookUrl ?? null,
        ebookDocumentId: dto.documentId ?? null,
      },
    });

    await this.audit.record({
      action: 'library.ebook_set',
      module: 'library',
      targetType: 'LibraryTitle',
      targetId: titleId,
      after: {
        link: !!dto.ebookUrl,
        file: !!dto.documentId,
      },
    });

    return { ok: true };
  }

  /** Where a member reads an e-book: the platform link, or a five-minute link to the library's own PDF. */
  async readEbook(user: AuthUser, titleId: string) {
    if (user.type !== 'STUDENT' && user.type !== 'STAFF') {
      throw new ForbiddenException({
        code: 'MEMBERS_ONLY',
        message: 'E-books are for students and staff.',
      });
    }

    const t = await this.prisma.libraryTitle.findUnique({
      where: { id: titleId },
      select: {
        ebookUrl: true,
        ebookDocumentId: true,
      },
    });

    if (!t || (!t.ebookUrl && !t.ebookDocumentId)) {
      throw new NotFoundException({
        code: 'NO_EBOOK',
        message: 'This title has no e-book.',
      });
    }

    await this.prisma.libraryTitle.update({
      where: { id: titleId },
      data: {
        ebookOpens: { increment: 1 },
      },
    });

    return t.ebookDocumentId
      ? this.documents.downloadUrl(user, t.ebookDocumentId)
      : t.ebookUrl!;
  }

  // ----- Inter-library loans -----

  mineIll(user: AuthUser) {
    return this.prisma.interLibraryLoan.findMany({
      where: { requesterId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async requestIll(
    user: AuthUser,
    dto: {
      title: string;
      authors?: string;
      isbn?: string;
      lendingLibrary?: string;
      neededBy?: string;
      note?: string;
    },
  ) {
    if (user.type !== 'STUDENT' && user.type !== 'STAFF') {
      throw new ForbiddenException({
        code: 'MEMBERS_ONLY',
        message: 'Inter-library loans are for students and staff.',
      });
    }

    const open = await this.prisma.interLibraryLoan.count({
      where: {
        requesterId: user.id,
        status: {
          in: ['REQUESTED', 'ORDERED', 'ARRIVED', 'ON_LOAN'],
        },
      },
    });

    if (open >= 3) {
      throw new ConflictException({
        code: 'TOO_MANY',
        message: 'You can have 3 inter-library requests open at a time.',
      });
    }

    const r = await this.prisma.interLibraryLoan.create({
      data: {
        requesterId: user.id,
        title: dto.title,
        authors: dto.authors || null,
        isbn: dto.isbn || null,
        lendingLibrary: dto.lendingLibrary || null,
        neededBy: dto.neededBy ? new Date(dto.neededBy) : null,
        note: dto.note || null,
      },
    });

    await this.audit.record({
      action: 'library.ill_requested',
      module: 'library',
      targetType: 'InterLibraryLoan',
      targetId: r.id,
      metadata: {
        title: dto.title,
      },
    });

    return r;
  }

  async cancelIll(user: AuthUser, id: string) {
    const r = await this.prisma.interLibraryLoan.findUnique({
      where: { id },
    });

    if (!r || r.requesterId !== user.id) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Request not found.',
      });
    }

    if (r.status !== 'REQUESTED') {
      throw new ConflictException({
        code: 'ORDERED',
        message:
          'The library has already ordered it. Ask at the desk.',
      });
    }

    await this.prisma.interLibraryLoan.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
    });

    return { ok: true };
  }

  listIll(status?: string) {
    return this.prisma.interLibraryLoan.findMany({
      where: status
        ? { status: status as never }
        : {
            status: {
              in: ['REQUESTED', 'ORDERED', 'ARRIVED', 'ON_LOAN'],
            },
          },
      orderBy: { createdAt: 'asc' },
      take: 300,
      include: {
        requester: {
          select: {
            firstName: true,
            lastName: true,
            indexNumber: true,
            email: true,
            phone: true,
          },
        },
      },
    });
  }

  async moveIll(
    user: AuthUser,
    id: string,
    dto: {
      status: IllStatus;
      dueDate?: string;
      note?: string;
    },
  ) {
    const r = await this.prisma.interLibraryLoan.findUnique({
      where: { id },
    });

    if (!r) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Request not found.',
      });
    }

    if (!illNext(r.status as IllStatus).includes(dto.status)) {
      throw new ConflictException({
        code: 'NOT_ALLOWED',
        message: `A request that is ${ILL_STATUS_LABEL[
          r.status as IllStatus
        ].toLowerCase()} cannot become ${ILL_STATUS_LABEL[
          dto.status
        ].toLowerCase()}.`,
      });
    }

    if (dto.status === 'ON_LOAN' && !dto.dueDate) {
      throw new BadRequestException({
        code: 'DUE',
        message: 'Set the due date the lending library gave.',
      });
    }

    if (dto.status === 'REJECTED' && !dto.note) {
      throw new BadRequestException({
        code: 'NOTE',
        message: 'Tell the member why.',
      });
    }

    await this.prisma.interLibraryLoan.update({
      where: { id },
      data: {
        status: dto.status,
        dueDate: dto.dueDate
          ? new Date(dto.dueDate)
          : r.dueDate,
        librarianNote: dto.note ?? r.librarianNote,
        updatedById: user.id,
      },
    });

    await this.audit.record({
      action: 'library.ill_updated',
      module: 'library',
      targetType: 'InterLibraryLoan',
      targetId: id,
      before: {
        status: r.status,
      },
      after: {
        status: dto.status,
      },
    });

    if (dto.status === 'ARRIVED' || dto.status === 'REJECTED') {
      await this.notifications.notify({
        eventKey: EVENT_KEYS.LIBRARY_ILL_UPDATE,
        recipients: [{ userId: r.requesterId }],
        channels: ['IN_APP', 'EMAIL', 'SMS'],
        sharedVars: {
          title: r.title,
          headline:
            dto.status === 'ARRIVED'
              ? 'has arrived: collect it at the library desk'
              : 'could not be obtained',
          detail: dto.note ?? '',
        },
        link: '/library',
      });
    }

    return { status: dto.status };
  }

  // ----- Reading lists -----

  private readonly ITEM_SELECT = {
    id: true,
    citation: true,
    url: true,
    importance: true,
    note: true,
    position: true,
    title: {
      select: {
        id: true,
        title: true,
        authors: true,
        edition: true,
        callNumber: true,
        ebookUrl: true,
        ebookDocumentId: true,
        copies: {
          select: {
            status: true,
          },
        },
      },
    },
  } as const;

  private present<
    T extends {
      title:
        | {
            copies: Array<{ status: string }>;
            ebookUrl: string | null;
            ebookDocumentId: string | null;
          }
        | null;
    },
  >(i: T) {
    if (!i.title) {
      return {
        ...i,
        availability: null,
      };
    }

    const { copies, ebookDocumentId, ...t } = i.title;

    return {
      ...i,
      title: {
        ...t,
        hasEbook: !!(t.ebookUrl || ebookDocumentId),
      },
      availability: {
        total: copies.filter(
          (c) => c.status !== 'WITHDRAWN' && c.status !== 'LOST',
        ).length,
        available: copies.filter(
          (c) => c.status === 'AVAILABLE',
        ).length,
      },
    };
  }

  async listFor(courseId: string) {
    const list = await this.prisma.readingList.findUnique({
      where: { courseId },
      select: {
        id: true,
        updatedAt: true,
        course: {
          select: {
            code: true,
            title: true,
          },
        },
        items: {
          orderBy: [
            { importance: 'asc' },
            { position: 'asc' },
          ],
          select: this.ITEM_SELECT,
        },
      },
    });

    return list
      ? {
          ...list,
          items: list.items.map((i) => this.present(i)),
        }
      : null;
  }

  /** The student's reading lists: their registered courses this semester. */
  async myLists(user: AuthUser) {
    const semester = await this.prisma.semester.findFirst({
      where: { isCurrent: true },
      select: { id: true },
    });

    if (!semester) return [];

    const items =
      await this.prisma.courseRegistrationItem.findMany({
        where: {
          registration: {
            studentId: user.id,
            semesterId: semester.id,
            status: {
              in: ['APPROVED', 'SUBMITTED'],
            },
          },
        },
        select: {
          offering: {
            select: {
              courseId: true,
            },
          },
        },
      });

    const lists = await Promise.all(
      items.map((i) => this.listFor(i.offering.courseId)),
    );

    return lists.filter(Boolean);
  }

  /** A lecturer on the course this semester, or the library, may edit its list. */
  private async assertEditor(
    user: AuthUser,
    courseId: string,
  ) {
    const perms = await this.perms(user);

    if (perms.has(PERMISSIONS.LIBRARY_MANAGE)) return;

    const teaches = await this.prisma.offeringLecturer.count({
      where: {
        userId: user.id,
        offering: {
          courseId,
          semester: {
            isCurrent: true,
          },
        },
      },
    });

    if (!teaches) {
      throw new ForbiddenException({
        code: 'NOT_LECTURER',
        message:
          'Only lecturers of this course this semester, or the Librarian, edit its reading list.',
      });
    }
  }

  async save(
    user: AuthUser,
    courseId: string,
    items: Array<{
      titleId?: string | null;
      citation?: string;
      url?: string;
      importance: 'ESSENTIAL' | 'RECOMMENDED';
      note?: string;
    }>,
  ) {
    await this.assertEditor(user, courseId);

    if (items.some((i) => !i.titleId && !i.citation)) {
      throw new BadRequestException({
        code: 'ITEM',
        message:
          'Each item needs a catalogue book or a reference.',
      });
    }

    if (
      items.some(
        (i) => i.url && !/^https?:\/\//.test(i.url),
      )
    ) {
      throw new BadRequestException({
        code: 'URL',
        message:
          'Links must start with http:// or https://.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const list = await tx.readingList.upsert({
        where: { courseId },
        create: {
          courseId,
          updatedById: user.id,
        },
        update: {
          updatedById: user.id,
        },
      });

      await tx.readingListItem.deleteMany({
        where: {
          listId: list.id,
        },
      });

      await tx.readingListItem.createMany({
        data: items.map((i, position) => ({
          listId: list.id,
          titleId: i.titleId || null,
          citation: i.citation || null,
          url: i.url || null,
          importance: i.importance,
          note: i.note || null,
          position,
        })),
      });
    });

    await this.audit.record({
      action: 'library.reading_list_saved',
      module: 'library',
      targetType: 'Course',
      targetId: courseId,
      after: {
        items: items.length,
        essential: items.filter(
          (i) => i.importance === 'ESSENTIAL',
        ).length,
      },
    });

    return this.listFor(courseId);
  }

  /** Courses the person may edit lists for this semester. */
  async editable(user: AuthUser) {
    const perms = await this.perms(user);

    const offerings =
      await this.prisma.courseOffering.findMany({
        where: {
          semester: {
            isCurrent: true,
          },
          ...(perms.has(PERMISSIONS.LIBRARY_MANAGE)
            ? {}
            : {
                lecturers: {
                  some: {
                    userId: user.id,
                  },
                },
              }),
        },
        orderBy: {
          course: {
            code: 'asc',
          },
        },
        select: {
          course: {
            select: {
              id: true,
              code: true,
              title: true,
              readingList: {
                select: {
                  _count: {
                    select: {
                      items: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    const seen = new Set<string>();

    return offerings
      .map((o) => o.course)
      .filter((c) =>
        seen.has(c.id)
          ? false
          : (seen.add(c.id), true),
      )
      .map((c) => ({
        id: c.id,
        code: c.code,
        title: c.title,
        items: c.readingList?._count.items ?? 0,
      }));
  }

  /** Essential books short of copies for this semester's enrolment (the library's buying list). */
  async demand() {
    const offerings =
      await this.prisma.courseOffering.findMany({
        where: {
          semester: {
            isCurrent: true,
          },
          course: {
            readingList: {
              isNot: null,
            },
          },
        },
        select: {
          id: true,
          course: {
            select: {
              code: true,
              title: true,
              readingList: {
                select: {
                  items: {
                    where: {
                      importance: 'ESSENTIAL',
                      titleId: {
                        not: null,
                      },
                    },
                    select: this.ITEM_SELECT,
                  },
                },
              },
            },
          },
          _count: {
            select: {
              items: {
                where: {
                  registration: {
                    status: 'APPROVED',
                  },
                },
              },
            },
          },
        },
      });

    const rows = offerings.flatMap((o) =>
      (o.course.readingList?.items ?? []).map((raw) => {
        const i = this.present(raw);

        const title = i.title;

        const copies = i.availability?.total ?? 0;

        const hasEbook =
          !!title &&
          !!(title.ebookUrl || title.ebookDocumentId);

        return {
          course: `${o.course.code} ${o.course.title}`,
          title: title?.title ?? 'Unknown title',
          students: o._count.items,
          copies,
          hasEbook,
          shortBy: readingShortfall({
            students: o._count.items,
            copies,
            hasEbook,
          }),
        };
      }),
    );

    return rows.sort((a, b) => b.shortBy - a.shortBy);
  }
}