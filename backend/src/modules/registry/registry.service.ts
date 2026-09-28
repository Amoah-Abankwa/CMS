import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { renderIndexNumber, usesProgrammeCode, validateIndexFormat } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { DepartmentDto, ProgrammeDto, ProgrammeTypeDto, SchoolDto } from './registry.dto';

const taken = (err: unknown, what: string) => {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException({ code: 'TAKEN', message: `Another ${what} already uses that code.` });
  throw err;
};

/** The Registrar's academic structure: schools, departments, programmes and programme types. */
@Injectable()
export class RegistryService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async devotionRule() {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: 'results.devotion' } });
    return { inTotals: (row?.value as { inTotals?: boolean } | null)?.inTotals ?? true };
  }

  async setDevotionRule(inTotals: boolean) {
    const before = await this.devotionRule();
    await this.prisma.systemSetting.upsert({ where: { key: 'results.devotion' }, create: { key: 'results.devotion', value: { inTotals } }, update: { value: { inTotals } } });
    await this.audit.record({ action: 'registry.devotion_rule_changed', module: 'registry', before, after: { inTotals } });
    return { inTotals };
  }

  async structure() {
    const [schools, types] = await Promise.all([
      this.prisma.school.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true, code: true, name: true,
          departments: {
            orderBy: { name: 'asc' },
            select: {
              id: true, code: true, name: true, schoolId: true,
              _count: { select: { courses: true, staff: true } },
              programmes: { orderBy: { name: 'asc' }, select: { id: true, code: true, name: true, levelCode: true, semesters: true, indexCode: true, isActive: true, departmentId: true, _count: { select: { students: true } } } },
            },
          },
        },
      }),
      this.prisma.programmeLevel.findMany({ orderBy: [{ category: 'asc' }, { code: 'asc' }], include: { _count: { select: { programmes: true } } } }),
    ]);
    const year = new Date().getUTCFullYear();
    return { schools, types: types.map((t) => ({ ...t, example: safe(() => renderIndexNumber(t.indexFormat, { year, code: t.code, sequence: 1, programmeCode: 'DCE' })), usesProgrammeCode: usesProgrammeCode(t.indexFormat) })) };
  }

  async saveSchool(dto: SchoolDto, id?: string) {
    try {
      const s = id ? await this.prisma.school.update({ where: { id }, data: dto }) : await this.prisma.school.create({ data: dto });
      await this.audit.record({ action: id ? 'registry.school_updated' : 'registry.school_created', module: 'registry', targetType: 'School', targetId: s.id, after: dto });
      return s;
    } catch (err) { return taken(err, 'school'); }
  }

  async saveDepartment(dto: DepartmentDto, id?: string) {
    try {
      const d = id ? await this.prisma.department.update({ where: { id }, data: dto }) : await this.prisma.department.create({ data: dto });
      await this.audit.record({ action: id ? 'registry.department_updated' : 'registry.department_created', module: 'registry', targetType: 'Department', targetId: d.id, after: dto });
      return d;
    } catch (err) { return taken(err, 'department'); }
  }

  async deleteDepartment(id: string) {
    const d = await this.prisma.department.findUnique({ where: { id }, select: { name: true, _count: { select: { programmes: true, courses: true, staff: true } } } });
    if (!d) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Department not found.' });
    const c = d._count;
    if (c.programmes || c.courses || c.staff) throw new ConflictException({ code: 'IN_USE', message: `${d.name} still has ${c.programmes} programmes, ${c.courses} courses and ${c.staff} staff. Move them first.` });
    await this.prisma.$transaction([this.prisma.associationDepartment.deleteMany({ where: { departmentId: id } }), this.prisma.department.delete({ where: { id } })]);
    await this.audit.record({ action: 'registry.department_deleted', module: 'registry', targetType: 'Department', targetId: id, before: { name: d.name } });
    return { ok: true };
  }

  async saveProgramme(dto: ProgrammeDto, id?: string) {
    const type = await this.prisma.programmeLevel.findUnique({ where: { code: dto.levelCode } });
    if (!type) throw new BadRequestException({ code: 'TYPE', message: 'Choose a programme type.' });
    if (usesProgrammeCode(type.indexFormat) && !dto.indexCode) {
      throw new BadRequestException({ code: 'INDEX_CODE', message: `${type.name} index numbers start with the programme's own code. Give this programme one, for example DCE.` });
    }
    const semesters = dto.semesters ?? null;
    const data = { code: dto.code, name: dto.name, departmentId: dto.departmentId, levelCode: dto.levelCode, semesters, indexCode: dto.indexCode ?? null, durationYears: Math.ceil((semesters ?? type.semesters) / 2), ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }) };
    if (id) {
      const current = await this.prisma.programme.findUniqueOrThrow({ where: { id }, select: { levelCode: true, indexCode: true, _count: { select: { students: true } } } });
      if (current.levelCode !== dto.levelCode && current._count.students) {
        throw new ConflictException({ code: 'HAS_STUDENTS', message: 'Students are already on this programme, and their index numbers follow its type. Create a new programme instead.' });
      }
      // Changing the code later would split one programme's students across two sequences; it is allowed, but only the Registrar's deliberate choice.
      if (current.indexCode && current.indexCode !== (dto.indexCode ?? null) && current._count.students) {
        throw new ConflictException({ code: 'INDEX_CODE_IN_USE', message: `Students already have ${current.indexCode} index numbers. Keep the code, so every student on the programme shares one sequence.` });
      }
    }
    try {
      const p = id ? await this.prisma.programme.update({ where: { id }, data }) : await this.prisma.programme.create({ data });
      await this.audit.record({ action: id ? 'registry.programme_updated' : 'registry.programme_created', module: 'registry', targetType: 'Programme', targetId: p.id, after: { code: dto.code, name: dto.name, type: dto.levelCode, semesters: semesters ?? type.semesters, indexCode: dto.indexCode ?? null } });
      return p;
    } catch (err) { return taken(err, 'programme (or index code)'); }
  }

  async deleteProgramme(id: string) {
    const p = await this.prisma.programme.findUnique({ where: { id }, select: { name: true, _count: { select: { students: true, curriculum: true, feeSchedules: true } } } });
    if (!p) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Programme not found.' });
    if (p._count.students || p._count.curriculum || p._count.feeSchedules) {
      throw new ConflictException({ code: 'IN_USE', message: `${p.name} has students, courses or fee schedules. Mark it inactive instead, so it stops taking new students but keeps its records.` });
    }
    await this.prisma.programme.delete({ where: { id } });
    await this.audit.record({ action: 'registry.programme_deleted', module: 'registry', targetType: 'Programme', targetId: id, before: { name: p.name } });
    return { ok: true };
  }

  async saveType(dto: ProgrammeTypeDto, existingCode?: string) {
    const problems = validateIndexFormat(dto.indexFormat);
    if (problems.length) throw new BadRequestException({ code: 'FORMAT', message: problems[0] });
    const { code, ...rest } = dto;
    if (existingCode && usesProgrammeCode(dto.indexFormat)) {
      const missing = await this.prisma.programme.findMany({ where: { levelCode: existingCode, indexCode: null }, select: { name: true } });
      if (missing.length) throw new BadRequestException({ code: 'INDEX_CODE', message: `Give these programmes an index code first: ${missing.map((m) => m.name).join(', ')}.` });
    }
    if (existingCode) {
      const before = await this.prisma.programmeLevel.findUnique({ where: { code: existingCode } });
      if (!before) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Programme type not found.' });
      const t = await this.prisma.programmeLevel.update({ where: { code: existingCode }, data: rest });
      await this.audit.record({ action: 'registry.type_updated', module: 'registry', targetType: 'ProgrammeLevel', targetId: existingCode, before: { indexFormat: before.indexFormat, semesters: before.semesters }, after: { indexFormat: t.indexFormat, semesters: t.semesters } });
      return t;
    }
    try {
      const t = await this.prisma.programmeLevel.create({ data: { code, ...rest } });
      await this.audit.record({ action: 'registry.type_created', module: 'registry', targetType: 'ProgrammeLevel', targetId: code, after: dto });
      return t;
    } catch (err) { return taken(err, 'programme type'); }
  }
}

function safe(fn: () => string) {
  try { return fn(); } catch { return null; }
}
