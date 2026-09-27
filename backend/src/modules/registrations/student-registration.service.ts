import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { SemestersService } from '../academics/semesters.service';
import { OFFERING_SELECT, presentOffering } from '../offerings/offerings.service';

type Semester = Awaited<ReturnType<SemestersService['resolve']>>;

/**
 * Course registration from the student's side. Students see the offered courses in their
 * programme's curriculum for their current level and semester, then save, submit and wait for approval.
 */
@Injectable()
export class StudentRegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly semesters: SemestersService,
    private readonly audit: AuditService,
  ) {}

  async overview(user: AuthUser, semesterId?: string) {
    const { profile, semester } = await this.context(user, semesterId);
    const [available, registration] = await Promise.all([this.available(profile, semester), this.current(user.id, semester.id)]);
    return { semester, profile: { level: profile.currentLevel, programme: profile.programme }, available, registration };
  }

  async save(user: AuthUser, offeringIds: string[]) {
    const { profile, semester } = await this.context(user);
    this.assertWindow(semester);
    const existing = await this.prisma.courseRegistration.findUnique({ where: { studentId_semesterId: { studentId: user.id, semesterId: semester.id } } });
    if (existing && (existing.status === 'SUBMITTED' || existing.status === 'APPROVED')) {
      throw new ConflictException({
        code: 'REGISTRATION_LOCKED',
        message: existing.status === 'APPROVED' ? 'Your registration is already approved. Contact your department to change it.' : 'Withdraw your submission before making changes.',
      });
    }

    const unique = [...new Set(offeringIds)];
    const available = await this.available(profile, semester);
    const byId = new Map(available.map((o) => [o.id, o]));
    const unknown = unique.filter((id) => !byId.has(id));
    if (unknown.length) throw new BadRequestException({ code: 'COURSE_NOT_AVAILABLE', message: 'One or more courses are not open to you this semester. Refresh the page.' });

    const credits = unique.reduce((sum, id) => sum + byId.get(id)!.course.creditHours, 0);
    if (credits > semester.maxCredits) {
      throw new BadRequestException({ code: 'TOO_MANY_CREDITS', message: `That is ${credits} credits. The limit this semester is ${semester.maxCredits}.` });
    }
    for (const id of unique) {
      const o = byId.get(id)!;
      if (o.capacity !== null && o.seatsTaken >= o.capacity) {
        throw new ConflictException({ code: 'COURSE_FULL', message: `${o.course.code} is full.` });
      }
    }

    const registration = await this.prisma.$transaction(async (tx) => {
      const reg = await tx.courseRegistration.upsert({
        where: { studentId_semesterId: { studentId: user.id, semesterId: semester.id } },
        create: { studentId: user.id, semesterId: semester.id },
        // Editing after a rejection starts a new draft; the reviewer's note stays visible for reference.
        update: { status: 'DRAFT' },
      });
      await tx.courseRegistrationItem.deleteMany({ where: { registrationId: reg.id } });
      if (unique.length) await tx.courseRegistrationItem.createMany({ data: unique.map((offeringId) => ({ registrationId: reg.id, offeringId })) });
      return reg;
    });
    await this.audit.record({
      action: 'registration.saved',
      module: 'registration',
      targetType: 'CourseRegistration',
      targetId: registration.id,
      after: { courses: unique.map((id) => byId.get(id)!.course.code), credits },
    });
    return this.overview(user, semester.id);
  }

  async submit(user: AuthUser) {
    const { semester } = await this.context(user);
    this.assertWindow(semester);
    const reg = await this.prisma.courseRegistration.findUnique({
      where: { studentId_semesterId: { studentId: user.id, semesterId: semester.id } },
      include: { items: { include: { offering: { include: { course: { select: { code: true, creditHours: true } } } } } } },
    });
    if (!reg || reg.items.length === 0) throw new BadRequestException({ code: 'NOTHING_SELECTED', message: 'Choose your courses and save before submitting.' });
    if (reg.status !== 'DRAFT') throw new ConflictException({ code: 'NOT_DRAFT', message: 'This registration has already been submitted.' });
    const credits = reg.items.reduce((sum, i) => sum + i.offering.course.creditHours, 0);
    if (credits < semester.minCredits) {
      throw new BadRequestException({ code: 'TOO_FEW_CREDITS', message: `You have ${credits} credits. Register for at least ${semester.minCredits}.` });
    }
    const held = await this.seatsHeld(reg.items.map((i) => i.offeringId), user.id);
    const full = reg.items.find((i) => i.offering.capacity !== null && (held.get(i.offeringId) ?? 0) >= i.offering.capacity);
    if (full) {
      throw new ConflictException({ code: 'COURSE_FULL', message: `${full.offering.course.code} filled up after you saved. Remove it and choose another course.` });
    }
    await this.prisma.courseRegistration.update({ where: { id: reg.id }, data: { status: 'SUBMITTED', submittedAt: new Date() } });
    await this.audit.record({ action: 'registration.submitted', module: 'registration', targetType: 'CourseRegistration', targetId: reg.id, metadata: { credits, courses: reg.items.length } });
    return this.overview(user, semester.id);
  }

  async withdraw(user: AuthUser) {
    const { semester } = await this.context(user);
    this.assertWindow(semester);
    const updated = await this.prisma.courseRegistration.updateMany({
      where: { studentId: user.id, semesterId: semester.id, status: 'SUBMITTED' },
      data: { status: 'DRAFT', submittedAt: null },
    });
    if (updated.count === 0) throw new ConflictException({ code: 'NOT_SUBMITTED', message: 'There is no submitted registration to withdraw.' });
    await this.audit.record({ action: 'registration.withdrawn', module: 'registration', metadata: { semesterId: semester.id } });
    return this.overview(user, semester.id);
  }

  private async context(user: AuthUser, semesterId?: string) {
    if (user.type !== 'STUDENT') throw new ForbiddenException({ code: 'STUDENTS_ONLY', message: 'Course registration is for students.' });
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: { programmeId: true, currentLevel: true, programme: { select: { code: true, name: true } } },
    });
    if (!profile) throw new ForbiddenException({ code: 'NO_PROFILE', message: 'Your student record is incomplete. Contact the Registry.' });
    return { profile, semester: await this.semesters.resolve(semesterId) };
  }

  private assertWindow(semester: Semester) {
    if (!semester.registrationOpen) {
      throw new ForbiddenException({ code: 'REGISTRATION_CLOSED', message: 'Course registration is closed for this semester.' });
    }
  }

  /** Offered courses in the student's curriculum for their level and this semester. */
  private async available(profile: { programmeId: string; currentLevel: number }, semester: Semester) {
    const rows = await this.prisma.courseOffering.findMany({
      where: {
        semesterId: semester.id,
        course: { isActive: true, curriculum: { some: { programmeId: profile.programmeId, level: profile.currentLevel, semesterNo: semester.number } } },
      },
      orderBy: { course: { code: 'asc' } },
      select: {
        ...OFFERING_SELECT,
      },
    });
    // Seats count submitted and approved registrations. Drafts do not hold a seat.
    const held = await this.seatsHeld(rows.map((r) => r.id));
    return rows.map((o) => ({ ...presentOffering(o), seatsTaken: held.get(o.id) ?? 0 }));
  }

  async seatsHeld(offeringIds: string[], excludeStudentId?: string) {
    const rows = await this.prisma.courseRegistrationItem.groupBy({
      by: ['offeringId'],
      where: {
        offeringId: { in: offeringIds },
        registration: { status: { in: ['SUBMITTED', 'APPROVED'] }, ...(excludeStudentId ? { studentId: { not: excludeStudentId } } : {}) },
      },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.offeringId, r._count._all]));
  }

  private async current(studentId: string, semesterId: string) {
    const reg = await this.prisma.courseRegistration.findUnique({
      where: { studentId_semesterId: { studentId, semesterId } },
      select: {
        id: true, status: true, submittedAt: true, reviewedAt: true, reviewNote: true,
        reviewedBy: { select: { firstName: true, lastName: true, staffProfile: { select: { title: true } } } },
        items: { select: { offeringId: true } },
      },
    });
    if (!reg) return null;
    const { reviewedBy, items, ...rest } = reg;
    return {
      ...rest,
      offeringIds: items.map((i) => i.offeringId),
      reviewedBy: reviewedBy ? [reviewedBy.staffProfile?.title, reviewedBy.firstName, reviewedBy.lastName].filter(Boolean).join(' ') : null,
    };
  }
}
