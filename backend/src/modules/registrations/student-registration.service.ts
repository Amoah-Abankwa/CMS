import { PdfDoc } from '../../core/pdf/pdf';
import { carryOverCourses, courseOpen, levelOfStage, missingPrerequisites, termName, registrationMode, stageOf, suggestedStage, type RegistrationMode, type SummerKind } from '@anu/shared';
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { SemestersService } from '../academics/semesters.service';
import { OFFERING_SELECT, presentOffering } from '../offerings/offerings.service';

type Semester = Awaited<ReturnType<SemestersService['resolve']>>;
type Profile = { userId: string; programmeId: string; currentLevel: number; programme: { code: string; name: string; department: { name: string }; level: { mode: string; semesters: number } } };

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
    const plan = this.plan(profile, semester, mainStage ?? registration?.mainStage ?? undefined, await this.lastMainStage(user.id, semester.id));
    const available = await this.available(profile, semester, plan);
    return {
      semester,
      profile: { level: profile.currentLevel, programme: profile.programme, department: profile.programme.department.name },
      mode: plan.mode,
      mainStage: plan.mode === 'REGULAR' ? plan.limitStage : null,
      suggestedStage: plan.suggested,
      totalStages: plan.totalStages,
      weekend: plan.weekend,
      available,
      registration,
    };
  }

  /** The main semester of the student's latest approved registration in another term. */
  private async lastMainStage(studentId: string, semesterId: string) {
    const r = await this.prisma.courseRegistration.findFirst({ where: { studentId, status: 'APPROVED', semesterId: { not: semesterId }, mainStage: { not: null } }, orderBy: { semester: { startDate: 'desc' } }, select: { mainStage: true } });
    return r?.mainStage ?? null;
  }

  /** How this student registers this term, and up to which curriculum stage. */
  private plan(profile: Profile, semester: Semester, mainStage?: number, lastApproved?: number | null) {
    const weekend = profile.programme.level.mode === 'WEEKEND';
    const totalStages = profile.programme.level.semesters;
    const mode: RegistrationMode = registrationMode(semester.number, weekend, (semester.summerKind ?? null) as SummerKind | null);
    const suggested = suggestedStage(profile.currentLevel, semester.number, weekend, totalStages, lastApproved);
    // Regular registration: the chosen main semester. Summer: the stage reached (end of the current level).
    const reached = Math.min(totalStages, Math.floor(profile.currentLevel / 100) * (weekend ? 3 : 2));
    const limitStage = mode === 'REGULAR' ? Math.max(1, Math.min(totalStages, mainStage ?? suggested)) : reached;
    return { mode, weekend, totalStages, suggested, limitStage };
  }

  async save(user: AuthUser, offeringIds: string[], mainStage?: number) {
    const { profile, semester } = await this.context(user);
    const plan = this.plan(profile, semester, mainStage, await this.lastMainStage(user.id, semester.id));
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
    const blocked = offeringIds.map((id) => byId.get(id)).filter((o): o is NonNullable<typeof o> => !!o && o.missingPrerequisites.length > 0);
    if (blocked.length) throw new BadRequestException({ code: 'PREREQUISITES', message: blocked.map((o) => `${o.course.code} needs ${o.missingPrerequisites.join(' and ')} taken first.`).join(' ') });
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
      select: { userId: true, programmeId: true, currentLevel: true, programme: { select: { code: true, name: true, department: { select: { name: true } }, level: { select: { mode: true, semesters: true } } } } },
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
    const [curriculum, attempts, approvals, earlier] = await Promise.all([
      this.prisma.programmeCourse.findMany({ where: { programmeId: profile.programmeId, course: { isActive: true } }, select: { courseId: true, level: true, semesterNo: true, isElective: true } }),
      this.prisma.courseResult.findMany({ where: { studentId: profile.userId, sheet: { status: 'PUBLISHED' } }, select: { isPass: true, incomplete: true, sheet: { select: { publishedAt: true, offering: { select: { courseId: true } } } } } }),
      // Courses outside the programme approved for this student this term.
      this.prisma.courseApproval.findMany({ where: { studentId: profile.userId, semesterId: semester.id, course: { isActive: true } }, select: { courseId: true } }),
      // Taken before: approved registrations in other terms (results may not be out yet).
      this.prisma.courseRegistrationItem.findMany({ where: { registration: { studentId: profile.userId, status: 'APPROVED', semesterId: { not: semester.id } } }, select: { offering: { select: { courseId: true } } } }),
    ]);
    // A prerequisite counts once taken before, with any grade.
    const taken = new Set([...attempts.map((a) => a.sheet.offering.courseId), ...earlier.map((e) => e.offering.courseId)]);
    const carry = carryOverCourses(attempts.map((a) => ({ courseId: a.sheet.offering.courseId, isPass: a.isPass, incomplete: a.incomplete, publishedAt: a.sheet.publishedAt ?? new Date(0) })));
    const passed = new Set(attempts.filter((a) => a.isPass).map((a) => a.sheet.offering.courseId));
    const inCurriculum = new Set(curriculum.map((c) => c.courseId));
    const open = [
      ...curriculum
        .map((c) => ({ ...c, stage: stageOf(c.level, c.semesterNo, plan.weekend), approved: false }))
        .filter((c) => courseOpen(plan.mode, c.stage, plan.limitStage, passed.has(c.courseId))),
      ...approvals.filter((a) => !inCurriculum.has(a.courseId)).map((a) => ({ courseId: a.courseId, level: 0, semesterNo: 0, isElective: true, stage: 0, approved: true })),
    ];
    if (!open.length) return [];
    const prereqs = await this.prisma.coursePrerequisite.findMany({ where: { courseId: { in: open.map((c) => c.courseId) } }, select: { courseId: true, prerequisite: { select: { id: true, code: true } } } });
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
        const needs = prereqs.filter((p) => p.courseId === o.courseId).map((p) => p.prerequisite);
        return { ...presentOffering(o), seatsTaken: held.get(o.id) ?? 0, stage: c.stage, isMain: plan.mode === 'REGULAR' && c.stage === plan.limitStage, isElective: c.isElective, approvedForYou: c.approved, passed: passed.has(o.courseId), carryOver: carry.includes(o.courseId), prerequisites: needs.map((n) => n.code), missingPrerequisites: missingPrerequisites(needs, taken) };
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
        id: true, status: true, submittedAt: true, reviewedAt: true, reviewNote: true, mainStage: true, createdAt: true,
        reviewedBy: { select: { firstName: true, lastName: true, staffProfile: { select: { title: true } } } },
        items: { select: { offeringId: true } },
        semester: { select: { number: true, academicYear: { select: { label: true } } } },
      },
    });
    if (!reg) return null;
    const { reviewedBy, items, semester, ...rest } = reg;
    return {
      ...rest,
      reference: registrationReference(reg.id, semester),
      offeringIds: items.map((i) => i.offeringId),
      reviewedBy: reviewedBy ? [reviewedBy.staffProfile?.title, reviewedBy.firstName, reviewedBy.lastName].filter(Boolean).join(' ') : null,
    };
  }

  /**
   * The student's registered courses (approved registrations only; ones waiting for approval stay on the
   * registration page), with where each stands, and their trailing courses: failed at the latest
   * attempt and not passed since.
   */
  async myCourses(user: AuthUser) {
    if (user.type !== 'STUDENT') throw new ForbiddenException({ code: 'STUDENTS_ONLY', message: 'This is for students.' });
    const [items, results] = await Promise.all([
      this.prisma.courseRegistrationItem.findMany({
        where: { registration: { studentId: user.id, status: 'APPROVED' } },
        select: {
          offeringId: true,
          offering: { select: { course: { select: { id: true, code: true, title: true, creditHours: true } }, semester: { select: { number: true, startDate: true, isCurrent: true, academicYear: { select: { label: true } } } } } },
        },
      }),
      this.prisma.courseResult.findMany({
        where: { studentId: user.id, sheet: { status: 'PUBLISHED' } },
        select: { grade: true, total: true, isPass: true, incomplete: true, sheet: { select: { offeringId: true, publishedAt: true, offering: { select: { course: { select: { id: true, code: true, title: true, creditHours: true } }, semester: { select: { number: true, academicYear: { select: { label: true } } } } } } } } },
      }),
    ]);
    const byOffering = new Map(results.map((r) => [r.sheet.offeringId, r]));
    const courses = items
      .map((i) => {
        const r = byOffering.get(i.offeringId);
        const status = r ? (r.incomplete ? 'INCOMPLETE' : r.isPass ? 'PASSED' : 'FAILED') : 'IN_PROGRESS';
        return { offeringId: i.offeringId, course: i.offering.course, term: `${i.offering.semester.academicYear.label} ${termName(i.offering.semester.number)}`, startDate: i.offering.semester.startDate, current: i.offering.semester.isCurrent, status, grade: r?.grade ?? null, total: r?.total ?? null };
      })
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime() || a.course.code.localeCompare(b.course.code));
    // Trailing: the latest attempt was a fail (incomplete results are not trailing).
    const trailingIds = new Set(carryOverCourses(results.map((r) => ({ courseId: r.sheet.offering.course.id, isPass: r.isPass, incomplete: r.incomplete, publishedAt: r.sheet.publishedAt ?? new Date(0) }))));
    const latest = new Map<string, (typeof results)[number]>();
    for (const r of results) {
      const id = r.sheet.offering.course.id;
      if (!trailingIds.has(id)) continue;
      const cur = latest.get(id);
      if (!cur || (r.sheet.publishedAt ?? new Date(0)) > (cur.sheet.publishedAt ?? new Date(0))) latest.set(id, r);
    }
    const retaking = new Set(courses.filter((c) => c.current).map((c) => c.course.id));
    const trailing = [...latest.values()]
      .map((r) => ({ course: r.sheet.offering.course, term: `${r.sheet.offering.semester.academicYear.label} ${termName(r.sheet.offering.semester.number)}`, grade: r.grade, total: r.total, registeredThisTerm: retaking.has(r.sheet.offering.course.id) }))
      .sort((a, b) => a.course.code.localeCompare(b.course.code));
    return { courses, trailing };
  }

  /** The registration slip as a PDF: student, term, courses, credits and the reference number. */
  async slipPdf(user: AuthUser, semesterId?: string) {
    const { profile, semester } = await this.context(user, semesterId);
    const reg = await this.prisma.courseRegistration.findUnique({
      where: { studentId_semesterId: { studentId: user.id, semesterId: semester.id } },
      select: { id: true, status: true, submittedAt: true, mainStage: true, student: { select: { firstName: true, middleName: true, lastName: true, indexNumber: true, studentProfile: { select: { programme: { select: { department: { select: { name: true } } } } } } } }, items: { select: { offering: { select: { course: { select: { code: true, title: true, creditHours: true } } } } } } },
    });
    if (!reg || reg.status === 'DRAFT') throw new BadRequestException({ code: 'NOT_SUBMITTED', message: 'Submit your registration first; the slip is for a submitted registration.' });
    const courses = reg.items.map((i) => i.offering.course).sort((a, b) => a.code.localeCompare(b.code));
    const credits = courses.reduce((t, c) => t + c.creditHours, 0);
    const ref = registrationReference(reg.id, semester);
    const s = reg.student;
    const d = await PdfDoc.create('Course registration slip', `${semester.academicYear.label} ${termName(semester.number)}. ${reg.status === 'APPROVED' ? 'Approved' : reg.status === 'SUBMITTED' ? 'Submitted, waiting for approval' : reg.status}`);
    d.rows([
      ['Student', [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ')],
      ['Index number', s.indexNumber ?? ''],
      ['Programme', profile.programme.name],
      ['Department', s.studentProfile?.programme.department.name ?? ''],
      ['Level', String(reg.mainStage ? levelOfStage(reg.mainStage, profile.programme.level.mode === 'WEEKEND') : profile.currentLevel)],
      ['Academic year', semester.academicYear.label],
      ['Semester', `${termName(semester.number)}${reg.mainStage ? ` (programme semester ${reg.mainStage})` : ''}`],
      ['Registration date', reg.submittedAt ? reg.submittedAt.toISOString().slice(0, 10) : ''],
      ['Reference', ref],
    ]);
    d.gap();
    d.table(['Code', 'Title', 'Credits'], courses.map((c) => [c.code, c.title, String(c.creditHours)]), [0.18, 0.67, 0.15], [2]);
    d.gap(6);
    d.text(`Total credit hours: ${credits}`, { bold: true });
    return { filename: `registration-${s.indexNumber ?? 'slip'}-${semester.academicYear.label.replace('/', '-')}-${termName(semester.number)}.pdf`, buffer: await d.toBuffer('All Nations University. Check a registration with the Registry by its reference.') };
  }
}

/** A short, stable reference for a registration, e.g. REG-2026F-3F9A2C1B. */
export function registrationReference(id: string, semester: { number: number; academicYear: { label: string } }) {
  return `REG-${semester.academicYear.label.slice(0, 4)}${'FSU'[semester.number - 1] ?? 'X'}-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}
