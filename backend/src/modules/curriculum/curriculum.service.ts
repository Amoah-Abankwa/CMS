import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { placeOfStage, prerequisiteLoop, stageOf } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const code = (v: string) => v.trim().toUpperCase().replace(/^([A-Z]+)\s*(\d)/, '$1 $2');

/**
 * Courses and each programme's curriculum, managed by staff with the curriculum permission (the
 * Curriculum Officer role, and the Registry). A curriculum places each course in a programme semester
 * (semester 1 to 8 of a regular Bachelor's degree) as core or elective.
 */
@Injectable()
export class CurriculumService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  // ----- Courses -----

  departments() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, code: true } });
  }

  async courses(q: { search?: string; departmentId?: string }) {
    const s = q.search?.trim();
    const rows = await this.prisma.course.findMany({
      where: { ...(q.departmentId ? { departmentId: q.departmentId } : {}), ...(s ? { OR: [{ code: { contains: s, mode: 'insensitive' } }, { title: { contains: s, mode: 'insensitive' } }] } : {}) },
      orderBy: { code: 'asc' },
      take: 500,
      select: {
        id: true, code: true, title: true, creditHours: true, description: true, isActive: true,
        department: { select: { id: true, name: true, code: true } },
        prerequisites: { select: { prerequisite: { select: { id: true, code: true, title: true } } } },
        _count: { select: { curriculum: true, offerings: true } },
      },
    });
    return rows.map(({ prerequisites, ...c }) => ({ ...c, prerequisites: prerequisites.map((p) => p.prerequisite) }));
  }

  async saveCourse(dto: { code: string; title: string; creditHours: number; departmentId: string; description?: string | null; isActive?: boolean }, id?: string) {
    const c = code(dto.code);
    if (!/^[A-Z]{2,5} \d{3}[A-Z]?$/.test(c)) throw new BadRequestException({ code: 'CODE', message: 'A course code looks like CSC 101.' });
    if (!(await this.prisma.department.count({ where: { id: dto.departmentId } }))) throw new BadRequestException({ code: 'DEPARTMENT', message: 'Choose the department that teaches it.' });
    const clash = await this.prisma.course.findFirst({ where: { code: c, NOT: id ? { id } : undefined }, select: { id: true } });
    if (clash) throw new ConflictException({ code: 'EXISTS', message: `${c} already exists.` });
    const data = { code: c, title: dto.title.trim(), creditHours: dto.creditHours, departmentId: dto.departmentId, description: dto.description?.trim() || null, ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}) };
    const before = id ? await this.prisma.course.findUnique({ where: { id } }) : null;
    if (id && !before) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Course not found.' });
    // Course.level and semesterNo are only a default placement; the curriculum decides where it is taught.
    const course = id ? await this.prisma.course.update({ where: { id }, data }) : await this.prisma.course.create({ data: { ...data, level: 100, semesterNo: 1 } });
    await this.audit.record({ action: id ? 'curriculum.course_updated' : 'curriculum.course_created', module: 'curriculum', targetType: 'Course', targetId: course.id, before: before ? { code: before.code, title: before.title, creditHours: before.creditHours } : undefined, after: { code: c, title: data.title, creditHours: dto.creditHours } });
    return course;
  }

  /** Deletes a course never used; one that has been taught is deactivated instead, so its history stays. */
  async deleteCourse(id: string) {
    const c = await this.prisma.course.findUnique({ where: { id }, select: { code: true, _count: { select: { offerings: true } } } });
    if (!c) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Course not found.' });
    if (c._count.offerings) {
      await this.prisma.course.update({ where: { id }, data: { isActive: false } });
      await this.audit.record({ action: 'curriculum.course_deactivated', module: 'curriculum', targetType: 'Course', targetId: id, metadata: { code: c.code } });
      return { deleted: false, deactivated: true };
    }
    await this.prisma.course.delete({ where: { id } });
    await this.audit.record({ action: 'curriculum.course_deleted', module: 'curriculum', targetType: 'Course', targetId: id, before: { code: c.code } });
    return { deleted: true };
  }

  async setPrerequisites(id: string, prerequisiteIds: string[]) {
    const course = await this.prisma.course.findUnique({ where: { id }, select: { code: true } });
    if (!course) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Course not found.' });
    const unique = [...new Set(prerequisiteIds)];
    const edges = (await this.prisma.coursePrerequisite.findMany({ where: { NOT: { courseId: id } }, select: { courseId: true, prerequisiteId: true } }));
    for (const p of unique) {
      if (prerequisiteLoop(id, p, edges)) {
        const pc = await this.prisma.course.findUnique({ where: { id: p }, select: { code: true } });
        throw new BadRequestException({ code: 'LOOP', message: `${pc?.code ?? 'That course'} cannot be a prerequisite of ${course.code}: it would need ${course.code} first.` });
      }
    }
    await this.prisma.$transaction([
      this.prisma.coursePrerequisite.deleteMany({ where: { courseId: id } }),
      this.prisma.coursePrerequisite.createMany({ data: unique.map((p) => ({ courseId: id, prerequisiteId: p })) }),
    ]);
    await this.audit.record({ action: 'curriculum.prerequisites_set', module: 'curriculum', targetType: 'Course', targetId: id, after: { prerequisites: unique.length } });
    return { ok: true };
  }

  // ----- A programme's curriculum -----

  private async programme(id: string) {
    const p = await this.prisma.programme.findUnique({ where: { id }, select: { id: true, code: true, name: true, level: { select: { mode: true, semesters: true, name: true } }, department: { select: { name: true } } } });
    if (!p) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Programme not found.' });
    return { ...p, weekend: p.level.mode === 'WEEKEND' };
  }

  programmes() {
    return this.prisma.programme.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true, level: { select: { name: true, semesters: true } }, _count: { select: { curriculum: true } } } });
  }

  async curriculum(programmeId: string) {
    const p = await this.programme(programmeId);
    const entries = await this.prisma.programmeCourse.findMany({
      where: { programmeId },
      select: { level: true, semesterNo: true, isElective: true, course: { select: { id: true, code: true, title: true, creditHours: true, isActive: true, prerequisites: { select: { prerequisite: { select: { code: true } } } } } } },
    });
    const rows = entries
      .map((e) => ({ stage: stageOf(e.level, e.semesterNo, p.weekend), isElective: e.isElective, course: { ...e.course, prerequisites: e.course.prerequisites.map((x) => x.prerequisite.code) } }))
      .sort((a, b) => a.stage - b.stage || a.course.code.localeCompare(b.course.code));
    return { programme: { id: p.id, code: p.code, name: p.name, type: p.level.name, department: p.department.name, totalStages: p.level.semesters, weekend: p.weekend }, entries: rows };
  }

  async placeCourse(programmeId: string, dto: { courseId: string; stage: number; isElective: boolean }) {
    const p = await this.programme(programmeId);
    if (dto.stage < 1 || dto.stage > p.level.semesters) throw new BadRequestException({ code: 'STAGE', message: `${p.name} has semesters 1 to ${p.level.semesters}.` });
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId }, select: { code: true } });
    if (!course) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Course not found.' });
    const { level, semesterNo } = placeOfStage(dto.stage, p.weekend);
    await this.prisma.programmeCourse.upsert({
      where: { programmeId_courseId: { programmeId, courseId: dto.courseId } },
      create: { programmeId, courseId: dto.courseId, level, semesterNo, isElective: dto.isElective },
      update: { level, semesterNo, isElective: dto.isElective },
    });
    await this.audit.record({ action: 'curriculum.course_placed', module: 'curriculum', targetType: 'Programme', targetId: programmeId, after: { course: course.code, semester: dto.stage, kind: dto.isElective ? 'elective' : 'core' } });
    return this.curriculum(programmeId);
  }

  async removeCourse(programmeId: string, courseId: string) {
    await this.programme(programmeId);
    await this.prisma.programmeCourse.deleteMany({ where: { programmeId, courseId } });
    await this.audit.record({ action: 'curriculum.course_removed', module: 'curriculum', targetType: 'Programme', targetId: programmeId, metadata: { courseId } });
    return this.curriculum(programmeId);
  }
}
