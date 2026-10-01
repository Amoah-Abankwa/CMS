import { ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import {
  gradeFor, INDEX_NUMBER_INPUT, parseAcademicYear, parseGender, parseImportDate, parseLevel, PERMISSIONS, PROGRAMME_INDEX_CODE, ROLE_KEYS, ROLE_SCOPE, scopeValue, SINGLE_HOLDER_ROLES, usesProgrammeCode,
  type ImportType, type RoleKey,
} from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JobsService } from '../../core/jobs/jobs.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AccountSetupService } from '../account-setup/account-setup.service';
import { AuditService } from '../audit/audit.service';
import { PermissionResolverService } from '../rbac/permission-resolver.service';

type Row = Record<string, string | undefined>;
export interface RowResult { row: number; action: 'create' | 'update' | 'skip' | 'error'; messages: string[] }

const QUEUE = 'import-setup-link';
/** Each kind of import also needs the permission for that kind of record. */
const NEEDS: Record<ImportType, string> = {
  STRUCTURE: PERMISSIONS.ACADEMICS_MANAGE,
  COURSES: PERMISSIONS.ACADEMICS_MANAGE,
  STAFF: PERMISSIONS.USERS_MANAGE,
  STUDENTS: PERMISSIONS.STUDENTS_REGISTER,
  RESULTS: PERMISSIONS.RESULTS_PUBLISH,
};
const PRIVILEGED: string[] = [ROLE_KEYS.SUPER_ADMIN, ROLE_KEYS.DEVELOPER, ...SINGLE_HOLDER_ROLES];

class RowError extends Error {}
const fail = (m: string): never => { throw new RowError(m); };
const courseCode = (v: string) => v.trim().toUpperCase().replace(/^([A-Z]+)\s*(\d)/, '$1 $2');
const clean = (v?: string) => (v ?? '').trim();

/**
 * Brings records over from the previous system. Every row is checked; a dry run reports what would
 * happen; the import applies each row on its own (so one bad row never stops the rest) and matches
 * existing records by index number, email or code, so running a corrected file again updates them.
 */
@Injectable()
export class ImportsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: PermissionResolverService,
    private readonly jobs: JobsService,
    private readonly setup: AccountSetupService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    await this.jobs.work<{ userId: string }>(QUEUE, async ({ userId }) => {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true, email: true } });
      if (u?.status === 'PENDING_SETUP' && u.email) await this.setup.sendSetupLink(userId);
    });
  }

  private async assertAllowed(user: AuthUser, type: ImportType) {
    const perms = await this.resolver.permissionsFor(user.id, user.activeRoleKey);
    if (!perms.has(PERMISSIONS.DATA_IMPORT) || !perms.has(NEEDS[type])) throw new ForbiddenException({ code: 'NOT_ALLOWED', message: 'You cannot import this kind of record.' });
  }

  async start(user: AuthUser, dto: { type: ImportType; fileName: string; totalRows: number }) {
    await this.assertAllowed(user, dto.type);
    return this.prisma.importBatch.create({ data: { type: dto.type, fileName: dto.fileName, totalRows: dto.totalRows, createdById: user.id } });
  }

  private async batch(user: AuthUser, id: string) {
    const b = await this.prisma.importBatch.findUnique({ where: { id } });
    if (!b || b.createdById !== user.id) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Import not found.' });
    await this.assertAllowed(user, b.type as ImportType);
    return b;
  }

  /** Checks (and when commit is true, applies) a chunk of rows. startRow is the file row of the first one. */
  async rows(user: AuthUser, batchId: string, rows: Row[], startRow: number, commit: boolean) {
    const b = await this.batch(user, batchId);
    if (b.finishedAt) throw new ForbiddenException({ code: 'FINISHED', message: 'This import is finished. Start a new one.' });
    const ctx = await this.context(b.type as ImportType);
    const results: RowResult[] = [];
    for (const [i, row] of rows.entries()) {
      const r: RowResult = { row: startRow + i, action: 'skip', messages: [] };
      try {
        r.action = await this.apply(b.type as ImportType, row, ctx, commit, r.messages, batchId, user);
      } catch (err) {
        r.action = 'error';
        r.messages.push(err instanceof RowError ? err.message : 'Could not be saved. Check the values and try again.');
      }
      results.push(r);
    }
    if (commit) {
      await this.prisma.importBatch.update({ where: { id: batchId }, data: { created: { increment: results.filter((r) => r.action === 'create').length }, updated: { increment: results.filter((r) => r.action === 'update').length }, failed: { increment: results.filter((r) => r.action === 'error').length } } });
    }
    return results;
  }

  async finish(user: AuthUser, batchId: string) {
    const b = await this.batch(user, batchId);
    const done = await this.prisma.importBatch.update({ where: { id: b.id }, data: { finishedAt: new Date() } });
    await this.audit.record({ action: 'imports.finished', module: 'imports', targetType: 'ImportBatch', targetId: b.id, metadata: { type: b.type, file: b.fileName, created: done.created, updated: done.updated, failed: done.failed } });
    return done;
  }

  async list(user: AuthUser) {
    const perms = await this.resolver.permissionsFor(user.id, user.activeRoleKey);
    if (!perms.has(PERMISSIONS.DATA_IMPORT)) throw new ForbiddenException({ code: 'NOT_ALLOWED', message: 'You cannot import records.' });
    const batches = await this.prisma.importBatch.findMany({ where: { finishedAt: { not: null } }, orderBy: { createdAt: 'desc' }, take: 50 });
    const pending = await this.prisma.user.groupBy({ by: ['importBatchId'], where: { importBatchId: { in: batches.map((b) => b.id) }, status: 'PENDING_SETUP', email: { not: null } }, _count: true });
    return batches.map((b) => ({ ...b, awaitingSetup: pending.find((p) => p.importBatchId === b.id)?._count ?? 0 }));
  }

  /** Emails set-up links to accounts an import created, spread out so the email service is not flooded. */
  async sendSetupLinks(user: AuthUser, batchId: string) {
    const b = await this.batch(user, batchId);
    const users = await this.prisma.user.findMany({ where: { importBatchId: b.id, status: 'PENDING_SETUP', email: { not: null } }, select: { id: true } });
    for (const [i, u] of users.entries()) await this.jobs.send(QUEUE, { userId: u.id }, { startAfter: Math.floor(i * 0.6) });
    await this.prisma.importBatch.update({ where: { id: b.id }, data: { setupSentAt: new Date() } });
    await this.audit.record({ action: 'imports.setup_links_sent', module: 'imports', targetType: 'ImportBatch', targetId: b.id, metadata: { accounts: users.length } });
    return { queued: users.length, minutes: Math.ceil((users.length * 0.6) / 60) };
  }

  // ----- Lookups shared by the rows of a chunk -----

  private async context(type: ImportType) {
    const [levels, scale, roles] = await Promise.all([
      this.prisma.programmeLevel.findMany({ select: { code: true, semesters: true, indexFormat: true, mode: true } }),
      type === 'RESULTS' ? this.prisma.gradingScale.findFirst({ where: { isActive: true }, include: { bands: true } }) : null,
      type === 'STAFF' ? this.prisma.role.findMany({ select: { id: true, key: true, name: true } }) : [],
    ]);
    return { levels, scale, roles, departments: new Map<string, { id: string; schoolId: string } | null>(), programmes: new Map<string, { id: string; levelCode: string } | null>(), courses: new Map<string, { id: string; creditHours: number } | null>() };
  }
  private async dept(ctx: Awaited<ReturnType<ImportsService['context']>>, code: string) {
    const k = code.toUpperCase();
    if (!ctx.departments.has(k)) ctx.departments.set(k, await this.prisma.department.findUnique({ where: { code: k }, select: { id: true, schoolId: true } }));
    return ctx.departments.get(k) ?? null;
  }
  private async programme(ctx: Awaited<ReturnType<ImportsService['context']>>, code: string) {
    const k = code.toUpperCase();
    if (!ctx.programmes.has(k)) ctx.programmes.set(k, await this.prisma.programme.findUnique({ where: { code: k }, select: { id: true, levelCode: true } }));
    return ctx.programmes.get(k) ?? null;
  }
  private async course(ctx: Awaited<ReturnType<ImportsService['context']>>, code: string) {
    const k = courseCode(code);
    if (!ctx.courses.has(k)) ctx.courses.set(k, await this.prisma.course.findUnique({ where: { code: k }, select: { id: true, creditHours: true } }));
    return ctx.courses.get(k) ?? null;
  }

  private async apply(type: ImportType, r: Row, ctx: Awaited<ReturnType<ImportsService['context']>>, commit: boolean, notes: string[], batchId: string, actor: AuthUser): Promise<RowResult['action']> {
    switch (type) {
      case 'STRUCTURE': {
        const schoolCode = clean(r.schoolCode).toUpperCase() || fail('School code is missing.');
        const deptCode = clean(r.departmentCode).toUpperCase() || fail('Department code is missing.');
        const progCode = clean(r.programmeCode).toUpperCase() || fail('Programme code is missing.');
        const progName = clean(r.programmeName) || fail('Programme name is missing.');
        const level = ctx.levels.find((l) => l.code === clean(r.programmeType)) ?? fail(`Programme type "${clean(r.programmeType)}" does not exist. Add it under Programme types first (codes: ${ctx.levels.map((l) => l.code).join(', ')}).`);
        const indexCode = clean(r.indexCode).toUpperCase() || null;
        if (indexCode && !PROGRAMME_INDEX_CODE.test(indexCode)) fail(`Index code "${indexCode}" should be 2 to 6 capital letters or digits.`);
        if (usesProgrammeCode(level.indexFormat) && !indexCode) fail('This programme type needs an index code (for example DCE).');
        const [school, dept, prog] = await Promise.all([this.prisma.school.findUnique({ where: { code: schoolCode } }), this.prisma.department.findUnique({ where: { code: deptCode } }), this.prisma.programme.findUnique({ where: { code: progCode } })]);
        if (!school && !clean(r.schoolName)) fail(`School ${schoolCode} is new: give its name.`);
        if (!dept && !clean(r.departmentName)) fail(`Department ${deptCode} is new: give its name.`);
        if (dept && school && dept.schoolId !== school.id) notes.push(`Department ${deptCode} is in another school; it stays there.`);
        if (!commit) return prog ? 'update' : 'create';
        const s = school ?? (await this.prisma.school.create({ data: { code: schoolCode, name: clean(r.schoolName) } }));
        const d = dept ?? (await this.prisma.department.create({ data: { code: deptCode, name: clean(r.departmentName), schoolId: s.id } }));
        const data = { name: progName, departmentId: d.id, levelCode: level.code, durationYears: Math.ceil(level.semesters / 2), indexCode };
        if (prog) await this.prisma.programme.update({ where: { id: prog.id }, data });
        else await this.prisma.programme.create({ data: { code: progCode, ...data } });
        return prog ? 'update' : 'create';
      }
      case 'COURSES': {
        const code = courseCode(clean(r.code) || fail('Course code is missing.'));
        if (!/^[A-Z]{2,5} \d{3}[A-Z]?$/.test(code)) fail(`Course code "${code}" should look like CSC 101.`);
        const title = clean(r.title) || fail('Title is missing.');
        const credits = Number(clean(r.credits));
        if (!Number.isInteger(credits) || credits < 0 || credits > 12) fail('Credit hours should be a whole number from 0 to 12.');
        const dept = (await this.dept(ctx, clean(r.departmentCode))) ?? fail(`Department "${clean(r.departmentCode)}" does not exist. Import departments first.`);
        const level = r.level ? parseLevel(r.level) ?? fail(`Level "${r.level}" should be 100, 200, ...`) : 100;
        const sem = r.semester ? Number(clean(r.semester)) : 1;
        const prog = clean(r.programmeCode) ? (await this.programme(ctx, clean(r.programmeCode))) ?? fail(`Programme "${clean(r.programmeCode)}" does not exist.`) : null;
        // Weekend programmes have three terms a year (Fall, Spring, Summer); regular ones two.
        const weekend = !!prog && ctx.levels.find((l) => l.code === prog.levelCode)?.mode === 'WEEKEND';
        if (!(sem === 1 || sem === 2 || (sem === 3 && weekend))) fail(weekend ? 'Semester should be 1 (Fall), 2 (Spring) or 3 (Summer).' : 'Semester should be 1 (Fall) or 2 (Spring).');
        const existing = await this.course(ctx, code);
        if (!commit) return existing ? 'update' : 'create';
        const c = existing
          ? await this.prisma.course.update({ where: { id: existing.id }, data: { title, creditHours: credits, departmentId: dept.id, level, semesterNo: sem } })
          : await this.prisma.course.create({ data: { code, title, creditHours: credits, departmentId: dept.id, level, semesterNo: sem } });
        ctx.courses.set(code, { id: c.id, creditHours: credits });
        if (prog) {
          const elective = /^(y|yes|true|1|elective)$/i.test(clean(r.elective));
          await this.prisma.programmeCourse.upsert({ where: { programmeId_courseId: { programmeId: prog.id, courseId: c.id } }, create: { programmeId: prog.id, courseId: c.id, level, semesterNo: sem, isElective: elective }, update: { level, semesterNo: sem, isElective: elective } });
        }
        return existing ? 'update' : 'create';
      }
      case 'STAFF': {
        const email = clean(r.email).toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(`"${email}" is not an email address.`);
        const firstName = clean(r.firstName) || fail('First name is missing.');
        const lastName = clean(r.lastName) || fail('Surname is missing.');
        const dept = clean(r.departmentCode) ? (await this.dept(ctx, clean(r.departmentCode))) ?? fail(`Department "${clean(r.departmentCode)}" does not exist.`) : null;
        const roles: Array<{ id: string; key: string; scope: string | null }> = [];
        for (const name of clean(r.roles).split(/[;|]/).map((x) => x.trim()).filter(Boolean)) {
          const role = ctx.roles.find((x) => x.key.toLowerCase() === name.toLowerCase().replace(/\s+/g, '_') || x.name.toLowerCase() === name.toLowerCase());
          if (!role) { notes.push(`Role "${name}" was not recognised and was left out.`); continue; }
          if (PRIVILEGED.includes(role.key)) { notes.push(`${role.name} is not given by import; set it on the Staff screens.`); continue; }
          const scopeType = ROLE_SCOPE[role.key as RoleKey];
          if (scopeType && !dept) { notes.push(`${role.name} needs a department; it was left out.`); continue; }
          roles.push({ id: role.id, key: role.key, scope: scopeType === 'department' ? scopeValue('department', dept!.id) : scopeType === 'school' ? scopeValue('school', dept!.schoolId) : null });
        }
        const existing = await this.prisma.user.findFirst({ where: { email }, select: { id: true, type: true, staffProfile: { select: { id: true } } } });
        if (existing && existing.type !== 'STAFF') fail('That email belongs to a student or partner account.');
        const staffNumber = clean(r.staffId).toUpperCase();
        if (!existing?.staffProfile && !staffNumber) fail('Staff ID is needed for new staff.');
        if (staffNumber) {
          const other = await this.prisma.staffProfile.findFirst({ where: { staffNumber, NOT: existing ? { userId: existing.id } : undefined }, select: { id: true } });
          if (other) fail(`Staff ID ${staffNumber} belongs to someone else.`);
        }
        if (!commit) return existing ? 'update' : 'create';
        const person = { firstName, middleName: clean(r.middleName) || null, lastName, phone: clean(r.phone) || null };
        const staff = { title: clean(r.title) || null, departmentId: dept?.id ?? null, isTeaching: roles.some((x) => x.key.includes('lecturer')) || undefined };
        const u = existing
          ? await this.prisma.user.update({ where: { id: existing.id }, data: person })
          : await this.prisma.user.create({ data: { ...person, email, type: 'STAFF', status: 'PENDING_SETUP', importBatchId: batchId } });
        if (existing?.staffProfile) await this.prisma.staffProfile.update({ where: { id: existing.staffProfile.id }, data: { ...staff, ...(staffNumber ? { staffNumber } : {}) } });
        else await this.prisma.staffProfile.create({ data: { ...staff, isTeaching: staff.isTeaching ?? false, staffNumber, userId: u.id } });
        for (const role of roles) {
          const has = await this.prisma.userRole.findFirst({ where: { userId: u.id, roleId: role.id, scope: role.scope } });
          if (!has) await this.prisma.userRole.create({ data: { userId: u.id, roleId: role.id, scope: role.scope } });
        }
        return existing ? 'update' : 'create';
      }
      case 'STUDENTS': {
        const index = clean(r.indexNumber).toUpperCase();
        if (!INDEX_NUMBER_INPUT.test(index)) fail(`Index number "${index}" cannot be used to sign in: it must start with a letter and use only letters, digits, / or -.`);
        const firstName = clean(r.firstName) || fail('First name is missing.');
        const lastName = clean(r.lastName) || fail('Surname is missing.');
        const prog = (await this.programme(ctx, clean(r.programmeCode))) ?? fail(`Programme "${clean(r.programmeCode)}" does not exist. Import programmes first.`);
        const level = parseLevel(clean(r.currentLevel)) ?? fail(`Level "${clean(r.currentLevel)}" should be 100, 200, ...`);
        const admissionYear = Number(clean(r.admissionYear));
        if (!Number.isInteger(admissionYear) || admissionYear < 1990 || admissionYear > new Date().getUTCFullYear()) fail(`Year admitted "${clean(r.admissionYear)}" is not a year.`);
        const gender = clean(r.gender) ? parseGender(clean(r.gender)) ?? (notes.push(`Gender "${clean(r.gender)}" was not recognised and was left blank.`), null) : null;
        const dob = clean(r.dateOfBirth) ? parseImportDate(clean(r.dateOfBirth)) ?? (notes.push(`Date of birth "${clean(r.dateOfBirth)}" was not recognised and was left blank.`), null) : null;
        const email = clean(r.email).toLowerCase() || null;
        if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(`"${email}" is not an email address.`);
        if (!email) notes.push('No email: the student cannot be sent a set-up link until one is added.');
        const st = clean(r.status).toLowerCase();
        const status = /graduat|withdr|dismiss|deceased|inactive|left/.test(st) ? 'DEACTIVATED' : 'PENDING_SETUP';
        const existing = await this.prisma.user.findUnique({ where: { indexNumber: index }, select: { id: true, type: true, status: true, studentProfile: { select: { id: true } } } });
        if (existing && existing.type !== 'STUDENT') fail('That index number belongs to another kind of account.');
        if (email) {
          const other = await this.prisma.user.findFirst({ where: { email, NOT: { indexNumber: index } }, select: { id: true } });
          if (other) fail(`The email ${email} belongs to someone else.`);
        }
        if (!commit) return existing ? 'update' : 'create';
        const profile = { programmeId: prog.id, levelCode: prog.levelCode, admissionYear, currentLevel: level, gender, dateOfBirth: dob ? new Date(`${dob}T00:00:00Z`) : null, nationality: clean(r.nationality) || null, externalRef: clean(r.cmsId) || null };
        const person = { firstName, middleName: clean(r.middleName) || null, lastName, email, phone: clean(r.phone) || null };
        await this.prisma.$transaction(async (tx) => {
          if (existing) {
            // An active account stays active unless the old system says the student has left.
            await tx.user.update({ where: { id: existing.id }, data: { ...person, ...(status === 'DEACTIVATED' ? { status } : {}) } });
            if (existing.studentProfile) await tx.studentProfile.update({ where: { id: existing.studentProfile.id }, data: profile });
            else await tx.studentProfile.create({ data: { ...profile, userId: existing.id } });
          } else {
            const u = await tx.user.create({ data: { ...person, indexNumber: index, type: 'STUDENT', status, importBatchId: batchId } });
            await tx.studentProfile.create({ data: { ...profile, userId: u.id } });
          }
        });
        return existing ? 'update' : 'create';
      }
      case 'RESULTS': {
        const scale = ctx.scale ?? fail('Set up the grading scale before importing results.');
        const index = clean(r.indexNumber).toUpperCase();
        const student = (await this.prisma.user.findUnique({ where: { indexNumber: index }, select: { id: true, type: true } })) ?? fail(`No student has index number ${index}. Import students first.`);
        if (student.type !== 'STUDENT') fail(`${index} is not a student.`);
        const course = (await this.course(ctx, clean(r.courseCode))) ?? fail(`Course "${clean(r.courseCode)}" does not exist. Import courses first.`);
        const yearLabel = parseAcademicYear(clean(r.academicYear)) ?? fail(`Academic year "${clean(r.academicYear)}" should look like 2023/2024.`);
        const semNo = Number(clean(r.semester));
        if (semNo !== 1 && semNo !== 2) fail('Semester should be 1 or 2.');
        const score = clean(r.score) === '' ? null : Number(clean(r.score));
        if (score !== null && !(score >= 0 && score <= 100)) fail(`Score "${clean(r.score)}" should be from 0 to 100.`);
        const letter = clean(r.grade).toUpperCase();
        const bandByLetter = letter ? scale.bands.find((b) => b.letter.toUpperCase() === letter) ?? fail(`Grade "${letter}" is not on the grading scale (${scale.bands.map((b) => b.letter).join(', ')}).`) : null;
        if (score === null && !bandByLetter) fail('Give the score, the grade, or both.');
        const band = bandByLetter ?? gradeFor(Math.round(score!), scale.bands);
        if (bandByLetter && score !== null && gradeFor(Math.round(score), scale.bands).letter !== bandByLetter.letter) notes.push(`Score ${score} would be ${gradeFor(Math.round(score), scale.bands).letter} on the current scale; the grade ${bandByLetter.letter} from the old system is kept.`);
        const start = Number(yearLabel.slice(0, 4));
        const year = await this.prisma.academicYear.findUnique({ where: { label: yearLabel } });
        const semester = year ? await this.prisma.semester.findFirst({ where: { academicYearId: year.id, number: semNo } }) : null;
        if (semester?.isCurrent) fail('Results for the current semester are entered on the platform, not imported.');
        const offering = semester ? await this.prisma.courseOffering.findFirst({ where: { courseId: course.id, semesterId: semester.id }, include: { resultSheet: true } }) : null;
        if (offering?.resultSheet && !offering.resultSheet.importedAt) fail('Results for this course that semester were entered on the platform; they are not replaced by an import.');
        const existing = offering?.resultSheet ? await this.prisma.courseResult.findFirst({ where: { sheetId: offering.resultSheet.id, studentId: student.id } }) : null;
        if (!commit) return existing ? 'update' : 'create';
        const y = year ?? (await this.prisma.academicYear.create({ data: { label: yearLabel, startDate: new Date(Date.UTC(start, 8, 1)), endDate: new Date(Date.UTC(start + 1, 7, 31)), isCurrent: false } }));
        const s = semester ?? (await this.prisma.semester.create({ data: { academicYearId: y.id, number: semNo, startDate: new Date(Date.UTC(semNo === 1 ? start : start + 1, semNo === 1 ? 8 : 1, 1)), endDate: new Date(Date.UTC(semNo === 1 ? start + 1 : start + 1, semNo === 1 ? 0 : 6, 31)), isCurrent: false } }));
        const o = offering ?? (await this.prisma.courseOffering.create({ data: { courseId: course.id, semesterId: s.id }, include: { resultSheet: true } }));
        const sheet = o.resultSheet ?? (await this.prisma.resultSheet.create({ data: { offeringId: o.id, status: 'PUBLISHED', scaleId: scale.id, publishedAt: new Date(), publishedById: actor.id, importedAt: new Date() } }));
        const total = score !== null ? Math.round(score) : band.minScore;
        const data = { credits: course.creditHours, caScore: 0, examScore: total, total, grade: band.letter, gradePoint: band.gradePoint, isPass: band.isPass, incomplete: false };
        if (existing) await this.prisma.courseResult.update({ where: { id: existing.id }, data });
        else await this.prisma.courseResult.create({ data: { ...data, sheetId: sheet.id, studentId: student.id } });
        return existing ? 'update' : 'create';
      }
    }
  }
}
