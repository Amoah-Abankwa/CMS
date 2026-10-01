import { carryOverCourses, courseOpen, termName, registrationMode, stageOf, suggestedStage, type RegistrationMode, type SummerKind } from '@anu/shared';
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { SemestersService } from '../academics/semesters.service';
import { OFFERING_SELECT, presentOffering } from '../offerings/offerings.service';

type Semester = Awaited<ReturnType<SemestersService['resolve']>>;
type Profile = { userId: string; programmeId: string; currentLevel: number; programme: { code: string; name: string; level: { mode: string; semesters: number } } };

/**
 * Course registration from the student's side. A student picks their main semester (curriculum stage)
 * and sees its courses, plus every course of lower semesters of their programme; in a regular student's
 * summer they see what the summer type allows. Every curriculum course can be taken every term (its
 * class is opened when needed). They save within the credit limit, submit, and wait for approval.
 */
@Injectable()
export class StudentRegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly semesters: SemestersService,
    private readonly audit: AuditService,
  ) {}

  async overview(user: AuthUser, semesterId?: string, mainStage?: number) {
    const { profile, semester } = await this.context(user, semesterId);
    const registration = await this.current(user.id, semester.id);
    const plan = this.plan(profile, semester, mainStage ?? registration?.mainStage ?? undefined);
    const available = await this.available(profile, semester, plan);
    return {
      semester,
      profile: { level: profile.currentLevel, programme: profile.programme },
      mode: plan.mode,
      mainStage: plan.mode === 'REGULAR' ? plan.limitStage : null,
      suggestedStage: plan.suggested,
      totalStages: plan.totalStages,
      weekend: plan.weekend,
      available,
      registration,
    };
  }

  /** How this student registers this term, and up to which curriculum stage. */
  private plan(profile: Profile, semester: Semester, mainStage?: number) {
    const weekend = profile.programme.level.mode === 'WEEKEND';
    const totalStages = profile.programme.level.semesters;
    const mode: RegistrationMode = registrationMode(semester.number, weekend, (semester.summerKind ?? null) as SummerKind | null);
    const suggested = suggestedStage(profile.currentLevel, semester.number, weekend, totalStages);
    // Regular registration: the chosen main semester. Summer: the stage reached (end of the current level).
    const reached = Math.min(totalStages, Math.floor(profile.currentLevel / 100) * (weekend ? 3 : 2));
    const limitStage = mode === 'REGULAR' ? Math.max(1, Math.min(totalStages, mainStage ?? suggested)) : reached;
    return { mode, weekend, totalStages, suggested, limitStage };
  }

  async save(user: AuthUser, offeringIds: string[], mainStage?: number) {
    const { profile, semester } = await this.context(user);
    const plan = this.plan(profile, semester, mainStage);
    if (plan.mode === 'SUMMER_NOT_SET') throw new BadRequestException({ code: 'SUMMER_NOT_SET', message: 'The academic office has not yet said whether this summer is promotional or upgrade.' });
    if (plan.mode === 'REGULAR' && (!mainStage || mainStage > plan.totalStages)) throw new BadRequestException({ code: 'MAIN_STAGE', message: 'Choose your main semester.' });
    this.assertWindow(semester);
    const existing = await this.prisma.courseRegistration.findUnique({ where: { studentId_semesterId: { studentId: user.id, semesterId: semester.id } } });
    if (existing && (existing.status === 'SUBMITTED' || existing.status === 'APPROVED')) {
      throw new ConflictException({
        code: 'REGISTRATION_LOCKED',
        message: existing.status === 'APPROVED' ? 'Your registration is already approved. Contact your department to change it.' : 'Withdraw your submission before making changes.',
      });
    }

    const unique = [...new Set(offeringIds)];
    const available = await this.available(profile, semester, plan);
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
        create: { studentId: user.id, semesterId: semester.id, mainStage: plan.mode === 'REGULAR' ? plan.limitStage : null },
        // Editing after a rejection starts a new draft; the reviewer's note stays visible for reference.
        update: { status: 'DRAFT', mainStage: plan.mode === 'REGULAR' ? plan.limitStage : null },
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
      after: { courses: unique.map((id) => byId.get(id)!.course.code), credits, mainStage: plan.mode === 'REGULAR' ? plan.limitStage : null },
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
      select: { userId: true, programmeId: true, currentLevel: true, programme: { select: { code: true, name: true, level: { select: { mode: true, semesters: true } } } } },
    });
    if (!profile) throw new ForbiddenException({ code: 'NO_PROFILE', message: 'Your student record is incomplete. Contact the Registry.' });
    return { profile, semester: await this.semesters.resolve(semesterId) };
  }

  private assertWindow(semester: Semester) {
    if (!semester.registrationOpen) {
      throw new ForbiddenException({ code: 'REGISTRATION_CLOSED', message: 'Course registration is closed for this semester.' });
    }
  }

  /**
   * The curriculum courses open to the student this term (see plan()). Every curriculum course can be
   * taken every term: its class for the term is opened here if it does not exist yet.
   */
  private async available(profile: Profile, semester: Semester, plan: ReturnType<StudentRegistrationService['plan']>) {
    if (plan.mode === 'SUMMER_NOT_SET') return [];
    const [curriculum, attempts] = await Promise.all([
      this.prisma.programmeCourse.findMany({ where: { programmeId: profile.programmeId, course: { isActive: true } }, select: { courseId: true, level: true, semesterNo: true, isElective: true } }),
      this.prisma.courseResult.findMany({ where: { studentId: profile.userId, sheet: { status: 'PUBLISHED' } }, select: { isPass: true, incomplete: true, sheet: { select: { publishedAt: true, offering: { select: { courseId: true } } } } } }),
    ]);
    const carry = carryOverCourses(attempts.map((a) => ({ courseId: a.sheet.offering.courseId, isPass: a.isPass, incomplete: a.incomplete, publishedAt: a.sheet.publishedAt ?? new Date(0) })));
    const passed = new Set(attempts.filter((a) => a.isPass).map((a) => a.sheet.offering.courseId));
    const open = curriculum
      .map((c) => ({ ...c, stage: stageOf(c.level, c.semesterNo, plan.weekend) }))
      .filter((c) => courseOpen(plan.mode, c.stage, plan.limitStage, passed.has(c.courseId)));
    if (!open.length) return [];
    await this.prisma.courseOffering.createMany({ data: open.map((c) => ({ courseId: c.courseId, semesterId: semester.id })), skipDuplicates: true });
    const rows = await this.prisma.courseOffering.findMany({
      where: { semesterId: semester.id, courseId: { in: open.map((c) => c.courseId) } },
      select: { ...OFFERING_SELECT, courseId: true },
    });
    const info = new Map(open.map((c) => [c.courseId, c]));
    // Seats count submitted and approved registrations. Drafts do not hold a seat.
    const held = await this.seatsHeld(rows.map((r) => r.id));
    return rows
      .map((o) => {
        const c = info.get(o.courseId)!;
        return { ...presentOffering(o), seatsTaken: held.get(o.id) ?? 0, stage: c.stage, isMain: plan.mode === 'REGULAR' && c.stage === plan.limitStage, isElective: c.isElective, passed: passed.has(o.courseId), carryOver: carry.includes(o.courseId) };
      })
      .sort((a, b) => b.stage - a.stage || a.course.code.localeCompare(b.course.code));
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
        id: true, status: true, submittedAt: true, reviewedAt: true, reviewNote: true, mainStage: true,
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

  /**
   * Every course the student has registered for, with where it stands: passed, failed or incomplete
   * (published results), in progress (approved), or waiting for approval.
   */
  async myCourses(user: AuthUser) {
    if (user.type !== 'STUDENT') throw new ForbiddenException({ code: 'STUDENTS_ONLY', message: 'This is for students.' });
    const items = await this.prisma.courseRegistrationItem.findMany({
      where: { registration: { studentId: user.id, status: { in: ['SUBMITTED', 'APPROVED'] } } },
      select: {
        offeringId: true,
        registration: { select: { status: true } },
        offering: { select: { course: { select: { id: true, code: true, title: true, creditHours: true } }, semester: { select: { number: true, startDate: true, academicYear: { select: { label: true } } } } } },
      },
    });
    const results = await this.prisma.courseResult.findMany({
      where: { studentId: user.id, sheet: { status: 'PUBLISHED', offeringId: { in: items.map((i) => i.offeringId) } } },
      select: { grade: true, total: true, isPass: true, incomplete: true, sheet: { select: { offeringId: true } } },
    });
    const byOffering = new Map(results.map((r) => [r.sheet.offeringId, r]));
    return items
      .map((i) => {
        const r = byOffering.get(i.offeringId);
        const status = r ? (r.incomplete ? 'INCOMPLETE' : r.isPass ? 'PASSED' : 'FAILED') : i.registration.status === 'APPROVED' ? 'IN_PROGRESS' : 'AWAITING_APPROVAL';
        return { offeringId: i.offeringId, course: i.offering.course, term: `${i.offering.semester.academicYear.label} ${termName(i.offering.semester.number)}`, startDate: i.offering.semester.startDate, status, grade: r?.grade ?? null, total: r?.total ?? null };
      })
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime() || a.course.code.localeCompare(b.course.code));
  }
}
