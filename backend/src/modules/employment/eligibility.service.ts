import { Injectable } from '@nestjs/common';
import { checkEligibility, gpa, type HoldCategory, type WorkEligibility } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { EmploymentRulesService } from './employment-rules.service';

export interface StudentStanding {
  cgpa: number | null;
  registered: boolean;
  holds: HoldCategory[];
  currentJobs: number;
}

/**
 * Whether students may work, from their published results, this semester's registration and any
 * disciplinary holds. Works on many students at once so lists of applicants stay fast.
 */
@Injectable()
export class EligibilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: EmploymentRulesService,
  ) {}

  async standing(studentIds: string[]): Promise<Map<string, StudentStanding>> {
    const ids = [...new Set(studentIds)];
    const out = new Map<string, StudentStanding>(ids.map((id) => [id, { cgpa: null, registered: false, holds: [], currentJobs: 0 }]));
    if (!ids.length) return out;
    const semester = await this.prisma.semester.findFirst({ where: { isCurrent: true }, select: { id: true } });
    const [results, registrations, holds, jobs] = await Promise.all([
      this.prisma.courseResult.findMany({ where: { studentId: { in: ids }, sheet: { status: 'PUBLISHED' } }, select: { studentId: true, credits: true, gradePoint: true, incomplete: true } }),
      semester ? this.prisma.courseRegistration.findMany({ where: { studentId: { in: ids }, semesterId: semester.id, status: 'APPROVED' }, select: { studentId: true } }) : [],
      semester ? this.prisma.examHold.findMany({ where: { studentId: { in: ids }, semesterId: semester.id, liftedAt: null }, select: { studentId: true, category: true } }) : [],
      this.prisma.jobApplication.groupBy({ by: ['studentId'], where: { studentId: { in: ids }, status: 'HIRED' }, _count: true }),
    ]);
    for (const id of ids) {
      const s = out.get(id)!;
      s.cgpa = gpa(results.filter((r) => r.studentId === id)).gpa;
    }
    for (const r of registrations) out.get(r.studentId)!.registered = true;
    for (const h of holds) out.get(h.studentId)!.holds.push(h.category as HoldCategory);
    for (const j of jobs) out.get(j.studentId)!.currentJobs = j._count;
    return out;
  }

  async check(studentId: string, opts: { jobMinCgpa?: number | null; forJob?: boolean; ignoreJobs?: number } = {}): Promise<WorkEligibility & { cgpa: number | null }> {
    const [s, rules] = await Promise.all([this.standing([studentId]).then((m) => m.get(studentId)!), this.rules.get()]);
    const result = checkEligibility({ ...s, currentJobs: Math.max(0, s.currentJobs - (opts.ignoreJobs ?? 0)) }, rules, opts);
    return { ...result, cgpa: s.cgpa };
  }
}
