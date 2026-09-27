import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ROLE_KEYS } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { ScopeService } from '../rbac/scope.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { SemestersService } from '../academics/semesters.service';
import { CreateDepartmentOfferingsDto, CreateOfferingDto, ListOfferingsDto } from './dto/offering.dto';

const TEACHING_ROLES = [ROLE_KEYS.LECTURER, ROLE_KEYS.TEACHING_ASSISTANT];

export const OFFERING_SELECT = {
  id: true,
  capacity: true,
  semesterId: true,
  course: { select: { id: true, code: true, title: true, creditHours: true, level: true, department: { select: { id: true, name: true } } } },
  lecturers: {
    orderBy: { isLead: 'desc' },
    select: { isLead: true, user: { select: { id: true, firstName: true, lastName: true, staffProfile: { select: { title: true } } } } },
  },
  _count: { select: { items: { where: { registration: { status: 'APPROVED' } } } } },
} satisfies Prisma.CourseOfferingSelect;

type OfferingRow = Prisma.CourseOfferingGetPayload<{ select: typeof OFFERING_SELECT }>;

export function presentOffering(o: OfferingRow) {
  const { _count, lecturers, ...rest } = o;
  return {
    ...rest,
    enrolled: _count.items,
    lecturers: lecturers.map((l) => ({
      id: l.user.id,
      name: [l.user.staffProfile?.title, l.user.firstName, l.user.lastName].filter(Boolean).join(' '),
      isLead: l.isLead,
    })),
  };
}

@Injectable()
export class OfferingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly semesters: SemestersService,
  ) {}

  async list(user: AuthUser, q: ListOfferingsDto) {
    const semester = await this.semesters.resolve(q.semesterId);
    const inScope = await this.scope.departmentFilter(user);
    const rows = await this.prisma.courseOffering.findMany({
      where: {
        semesterId: semester.id,
        course: {
          departmentId: q.departmentId ? (inScope && !inScope.in.includes(q.departmentId) ? { in: [] } : q.departmentId) : inScope,
          ...(q.search ? { OR: [{ code: { contains: q.search, mode: 'insensitive' as const } }, { title: { contains: q.search, mode: 'insensitive' as const } }] } : {}),
        },
      },
      orderBy: { course: { code: 'asc' } },
      select: OFFERING_SELECT,
    });
    return { semester, items: rows.map(presentOffering) };
  }

  /** Departments the person can create offerings for, for the filter and bulk-create menus. */
  async departments(user: AuthUser) {
    const inScope = await this.scope.departmentFilter(user);
    return this.prisma.department.findMany({
      where: { id: inScope },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, school: { select: { name: true } } },
    });
  }

  /** Active courses in scope that are not yet offered in the semester. */
  async courseOptions(user: AuthUser, semesterId: string, departmentId?: string) {
    const inScope = await this.scope.departmentFilter(user);
    if (departmentId) await this.scope.assertDepartment(user, departmentId);
    return this.prisma.course.findMany({
      where: { isActive: true, departmentId: departmentId ?? inScope, offerings: { none: { semesterId } } },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, title: true, creditHours: true, level: true, semesterNo: true },
    });
  }

  async create(user: AuthUser, dto: CreateOfferingDto) {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId }, select: { id: true, departmentId: true, isActive: true, code: true } });
    if (!course || !course.isActive) throw new BadRequestException({ code: 'COURSE_INVALID', message: 'Choose an active course.' });
    await this.scope.assertDepartment(user, course.departmentId);
    await this.semesters.resolve(dto.semesterId);
    try {
      const created = await this.prisma.courseOffering.create({ data: { courseId: course.id, semesterId: dto.semesterId, capacity: dto.capacity }, select: OFFERING_SELECT });
      await this.audit.record({ action: 'offering.created', module: 'teaching', targetType: 'CourseOffering', targetId: created.id, after: { course: course.code, capacity: dto.capacity } });
      return presentOffering(created);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ code: 'ALREADY_OFFERED', message: `${course.code} is already offered this semester.` });
      }
      throw err;
    }
  }

  /** Offers every active course of a department that belongs to this semester (first or second). */
  async createForDepartment(user: AuthUser, dto: CreateDepartmentOfferingsDto) {
    await this.scope.assertDepartment(user, dto.departmentId);
    const semester = await this.semesters.resolve(dto.semesterId);
    const courses = await this.prisma.course.findMany({
      where: { departmentId: dto.departmentId, isActive: true, semesterNo: semester.number },
      select: { id: true },
    });
    const result = await this.prisma.courseOffering.createMany({
      data: courses.map((c) => ({ courseId: c.id, semesterId: semester.id })),
      skipDuplicates: true,
    });
    await this.audit.record({ action: 'offering.bulk_created', module: 'teaching', metadata: { departmentId: dto.departmentId, semesterId: semester.id, created: result.count } });
    return { created: result.count, alreadyOffered: courses.length - result.count };
  }

  async updateCapacity(user: AuthUser, id: string, capacity: number | null) {
    const offering = await this.load(user, id);
    if (capacity !== null && capacity < offering._count.items) {
      throw new BadRequestException({ code: 'CAPACITY_TOO_LOW', message: `${offering._count.items} students are already approved. The limit cannot be lower than that.` });
    }
    const updated = await this.prisma.courseOffering.update({ where: { id }, data: { capacity }, select: OFFERING_SELECT });
    await this.audit.record({ action: 'offering.capacity_changed', module: 'teaching', targetType: 'CourseOffering', targetId: id, before: { capacity: offering.capacity }, after: { capacity } });
    return presentOffering(updated);
  }

  async remove(user: AuthUser, id: string) {
    const offering = await this.load(user, id);
    const anyRegistrations = await this.prisma.courseRegistrationItem.count({ where: { offeringId: id } });
    if (anyRegistrations > 0) {
      throw new ConflictException({ code: 'OFFERING_IN_USE', message: 'Students have already chosen this course. It cannot be removed.' });
    }
    await this.prisma.courseOffering.delete({ where: { id } });
    await this.audit.record({ action: 'offering.removed', module: 'teaching', targetType: 'CourseOffering', targetId: id, before: { course: offering.course.code } });
  }

  /** Staff who hold the Lecturer or Teaching Assistant role. Lecturers may teach other departments' courses. */
  lecturerOptions(search?: string) {
    return this.prisma.user.findMany({
      where: {
        type: 'STAFF',
        status: { in: ['ACTIVE', 'PENDING_SETUP'] },
        roles: { some: { role: { key: { in: TEACHING_ROLES } } } },
        ...(search ? { OR: [{ firstName: { contains: search, mode: 'insensitive' as const } }, { lastName: { contains: search, mode: 'insensitive' as const } }] } : {}),
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 200,
      select: { id: true, firstName: true, lastName: true, staffProfile: { select: { title: true, department: { select: { name: true } } } } },
    });
  }

  async setLecturers(user: AuthUser, id: string, lecturers: Array<{ userId: string; isLead: boolean }>) {
    const offering = await this.load(user, id);
    const ids = lecturers.map((l) => l.userId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException({ code: 'DUPLICATE_LECTURER', message: 'Each lecturer can only be listed once.' });
    if (lecturers.length > 0 && lecturers.filter((l) => l.isLead).length !== 1) {
      throw new BadRequestException({ code: 'LEAD_REQUIRED', message: 'Choose exactly one lead lecturer.' });
    }
    const eligible = await this.prisma.user.count({
      where: { id: { in: ids }, type: 'STAFF', roles: { some: { role: { key: { in: TEACHING_ROLES } } } } },
    });
    if (eligible !== ids.length) {
      throw new BadRequestException({ code: 'NOT_TEACHING_STAFF', message: 'Only staff with the Lecturer or Teaching Assistant role can be assigned.' });
    }

    const previous = new Set(offering.lecturers.map((l) => l.user.id));
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.offeringLecturer.deleteMany({ where: { offeringId: id } });
      if (lecturers.length) await tx.offeringLecturer.createMany({ data: lecturers.map((l) => ({ offeringId: id, userId: l.userId, isLead: l.isLead })) });
      return tx.courseOffering.findUniqueOrThrow({ where: { id }, select: OFFERING_SELECT });
    });

    await this.audit.record({
      action: 'offering.lecturers_set',
      module: 'teaching',
      targetType: 'CourseOffering',
      targetId: id,
      before: offering.lecturers.map((l) => ({ userId: l.user.id, isLead: l.isLead })),
      after: lecturers,
    });

    const added = lecturers.filter((l) => !previous.has(l.userId));
    if (added.length) {
      const semester = await this.semesters.resolve(offering.semesterId);
      await this.notifications.notify({
        eventKey: EVENT_KEYS.TEACHING_ASSIGNED,
        recipients: added.map((l) => ({ userId: l.userId, vars: { leadNote: l.isLead ? ' as lead lecturer' : '' } })),
        channels: ['IN_APP', 'EMAIL'],
        sharedVars: { courseCode: offering.course.code, courseTitle: offering.course.title, semesterLabel: semester.label },
        link: '/teaching',
      });
    }
    return presentOffering(updated);
  }

  /** Approved students in an offering. */
  roster(offeringId: string) {
    return this.prisma.courseRegistrationItem
      .findMany({
        where: { offeringId, registration: { status: 'APPROVED' } },
        orderBy: { registration: { student: { indexNumber: 'asc' } } },
        select: {
          registration: {
            select: {
              student: {
                select: {
                  id: true, indexNumber: true, firstName: true, middleName: true, lastName: true, email: true,
                  studentProfile: { select: { currentLevel: true, programme: { select: { code: true, name: true } } } },
                },
              },
            },
          },
        },
      })
      .then((rows) => rows.map((r) => r.registration.student));
  }

  /** Loads an offering the person may manage, or throws. */
  async load(user: AuthUser, id: string) {
    const offering = await this.prisma.courseOffering.findUnique({ where: { id }, select: OFFERING_SELECT });
    if (!offering) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Course offering not found.' });
    await this.scope.assertDepartment(user, offering.course.department.id);
    return offering;
  }
}
