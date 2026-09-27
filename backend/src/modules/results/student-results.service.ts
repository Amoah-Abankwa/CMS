import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { SemestersService } from '../academics/semesters.service';
import { gpa } from './grading';

/** What a student sees: published results with GPA, and continuous assessment their lecturers have shared. */
@Injectable()
export class StudentResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly semesters: SemestersService,
  ) {}

  async results(user: AuthUser) {
    this.assertStudent(user);
    const rows = await this.prisma.courseResult.findMany({
      where: { studentId: user.id, sheet: { status: 'PUBLISHED' } },
      select: {
        credits: true, total: true, grade: true, gradePoint: true, isPass: true, incomplete: true,
        sheet: {
          select: {
            publishedAt: true,
            offering: {
              select: {
                course: { select: { code: true, title: true } },
                semester: { select: { id: true, number: true, startDate: true, academicYear: { select: { label: true } } } },
              },
            },
          },
        },
      },
    });

    type Course = {
      code: string; title: string; credits: number; total: number; grade: string;
      gradePoint: number; isPass: boolean; incomplete: boolean; publishedAt: Date | null;
    };
    const bySemester = new Map<string, { id: string; label: string; start: Date; courses: Course[] }>();
    for (const r of rows) {
      const s = r.sheet.offering.semester;
      if (!bySemester.has(s.id)) bySemester.set(s.id, { id: s.id, label: `${s.academicYear.label}, Semester ${s.number}`, start: s.startDate, courses: [] });
      bySemester.get(s.id)!.courses.push({
        code: r.sheet.offering.course.code, title: r.sheet.offering.course.title, credits: r.credits, total: r.total,
        grade: r.grade, gradePoint: r.gradePoint, isPass: r.isPass, incomplete: r.incomplete, publishedAt: r.sheet.publishedAt,
      });
    }

    const semesters = [...bySemester.values()]
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map((s) => {
        const sorted = s.courses.sort((a, b) => a.code.localeCompare(b.code));
        const g = gpa(sorted);
        return { id: s.id, label: s.label, courses: sorted, gpa: g.gpa, credits: g.credits };
      });
    const overall = gpa(rows);
    const creditsPassed = rows.filter((r) => r.isPass).reduce((s, r) => s + r.credits, 0);
    return { cgpa: overall.gpa, creditsAttempted: overall.credits, creditsPassed, semesters };
  }

  /** Continuous assessment marks shared by lecturers, for courses the student is approved for this semester. */
  async internals(user: AuthUser, semesterId?: string) {
    this.assertStudent(user);
    const semester = await this.semesters.resolve(semesterId);
    const offerings = await this.prisma.courseOffering.findMany({
      where: { semesterId: semester.id, items: { some: { registration: { studentId: user.id, status: 'APPROVED' } } } },
      orderBy: { course: { code: 'asc' } },
      select: {
        id: true,
        course: { select: { code: true, title: true } },
        assessments: {
          where: { kind: 'CONTINUOUS', releasedAt: { not: null } },
          orderBy: { position: 'asc' },
          select: {
            id: true, name: true, weight: true, maxScore: true, releasedAt: true,
            marks: { where: { studentId: user.id, releasedAt: { not: null } }, select: { releasedScore: true, releasedAbsent: true } },
          },
        },
      },
    });
    return {
      semester: { id: semester.id, label: semester.label },
      courses: offerings.map((o) => ({
        offeringId: o.id,
        course: o.course,
        assessments: o.assessments.map(({ marks, ...a }) => ({
          ...a,
          score: marks[0]?.releasedScore ?? null,
          absent: marks[0]?.releasedAbsent ?? false,
          contribution: marks[0]?.releasedScore != null ? Math.round((marks[0].releasedScore / a.maxScore) * a.weight * 100) / 100 : null,
        })),
      })),
    };
  }

  private assertStudent(user: AuthUser) {
    if (user.type !== 'STUDENT') throw new ForbiddenException({ code: 'STUDENTS_ONLY', message: 'This page is for students.' });
  }
}
