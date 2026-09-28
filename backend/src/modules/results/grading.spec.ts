import { computeTotal, gpa, gradeFor, validateScale, weightsProblem, type Band, type Component } from './grading';

const BANDS: Band[] = [
  { letter: 'A', minScore: 80, gradePoint: 4, isPass: true },
  { letter: 'B+', minScore: 75, gradePoint: 3.5, isPass: true },
  { letter: 'B', minScore: 70, gradePoint: 3, isPass: true },
  { letter: 'C+', minScore: 65, gradePoint: 2.5, isPass: true },
  { letter: 'C', minScore: 60, gradePoint: 2, isPass: true },
  { letter: 'D+', minScore: 55, gradePoint: 1.5, isPass: true },
  { letter: 'D', minScore: 50, gradePoint: 1, isPass: true },
  { letter: 'F', minScore: 0, gradePoint: 0, isPass: false },
];

const COMPONENTS: Component[] = [
  { id: 'mid', kind: 'CONTINUOUS', weight: 20, maxScore: 50 },
  { id: 'asg', kind: 'CONTINUOUS', weight: 20, maxScore: 20 },
  { id: 'exam', kind: 'EXAM', weight: 60, maxScore: 100 },
];

describe('grading', () => {
  it('accepts the default scale', () => {
    expect(validateScale(BANDS, 50, 4)).toEqual([]);
  });

  it('rejects a scale without a band at 0', () => {
    expect(validateScale(BANDS.slice(0, -1), 50, 4)).toContain('The lowest grade must start at 0 so every score gets a grade.');
  });

  it('rejects a pass flag that contradicts the pass mark', () => {
    const bad = BANDS.map((b) => (b.letter === 'D' ? { ...b, isPass: false } : b));
    expect(validateScale(bad, 50, 4).join(' ')).toMatch(/D should be marked as a pass/);
  });

  it('grades band boundaries correctly', () => {
    expect(gradeFor(80, BANDS).letter).toBe('A');
    expect(gradeFor(79, BANDS).letter).toBe('B+');
    expect(gradeFor(50, BANDS).letter).toBe('D');
    expect(gradeFor(49, BANDS).letter).toBe('F');
  });

  it('requires weights to add up to 100', () => {
    expect(weightsProblem(COMPONENTS)).toBeNull();
    expect(weightsProblem(COMPONENTS.slice(0, 2))).toMatch(/40%/);
  });

  it('computes weighted totals and rounds half up', () => {
    const marks = new Map([
      ['mid', { score: 40, absent: false }], // 16
      ['asg', { score: 15, absent: false }], // 15
      ['exam', { score: 58, absent: false }], // 34.8
    ]);
    const r = computeTotal(COMPONENTS, marks);
    expect(r).toMatchObject({ caScore: 31, examScore: 34.8, total: 66, incomplete: false, missing: 0 });

    const half = computeTotal([{ id: 'x', kind: 'EXAM', weight: 100, maxScore: 100 }], new Map([['x', { score: 69.5, absent: false }]]));
    expect(half.total).toBe(70);
  });

  it('marks exam absence as incomplete and counts missing marks', () => {
    const marks = new Map([
      ['mid', { score: 40, absent: false }],
      ['exam', { score: null, absent: true }],
    ]);
    const r = computeTotal(COMPONENTS, marks);
    expect(r.incomplete).toBe(true);
    expect(r.missing).toBe(1);
  });

  it('calculates GPA weighted by credits, skipping incomplete results', () => {
    expect(
      gpa([
        { credits: 3, gradePoint: 4, incomplete: false },
        { credits: 2, gradePoint: 2.5, incomplete: false },
        { credits: 3, gradePoint: 0, incomplete: true },
      ]),
    ).toEqual({ gpa: 3.4, credits: 5 });
    expect(gpa([])).toEqual({ gpa: null, credits: 0 });
  });
});

import { amendedResult, carryOverCourses } from '@anu/shared';

describe('carry-over courses', () => {
  it('lists courses whose latest attempt was a fail', () => {
    const r = carryOverCourses([
      { courseId: 'CSC101', isPass: false, incomplete: false, publishedAt: '2025-12-20' },
      { courseId: 'CSC101', isPass: true, incomplete: false, publishedAt: '2026-05-20' },
      { courseId: 'CSC103', isPass: false, incomplete: false, publishedAt: '2026-05-20' },
      { courseId: 'CSC105', isPass: false, incomplete: true, publishedAt: '2026-05-20' },
      { courseId: 'MTH101', isPass: true, incomplete: false, publishedAt: '2025-12-20' },
      { courseId: 'MTH101', isPass: false, incomplete: false, publishedAt: '2026-05-20' },
    ]);
    expect(r.sort()).toEqual(['CSC103', 'MTH101']);
  });
});

describe('amended results', () => {
  const bands = [
    { letter: 'A', minScore: 80, gradePoint: 4, isPass: true },
    { letter: 'B', minScore: 70, gradePoint: 3, isPass: true },
    { letter: 'D', minScore: 50, gradePoint: 1, isPass: true },
    { letter: 'F', minScore: 0, gradePoint: 0, isPass: false },
  ];
  it('regrades the corrected scores on the sheet scale', () => {
    expect(amendedResult(28.5, 41, bands)).toMatchObject({ total: 70, grade: 'B', gradePoint: 3, isPass: true, incomplete: false });
    expect(amendedResult(20, 25, bands)).toMatchObject({ total: 45, grade: 'F', isPass: false });
  });
});

import { courseTotalWithDevotion } from '@anu/shared';

describe('morning devotion in course totals', () => {
  it('adds the devotion score to course marks out of 95', () => {
    expect(courseTotalWithDevotion(76, { score: 4.25 })).toBe(80);
    expect(courseTotalWithDevotion(95, { score: 5 })).toBe(100);
    expect(courseTotalWithDevotion(44.5, { score: 0.5 })).toBe(45);
  });
  it('scales weekend students from 95 to 100', () => {
    expect(courseTotalWithDevotion(76, { exempt: true })).toBe(80);
    expect(courseTotalWithDevotion(95, { exempt: true })).toBe(100);
    expect(courseTotalWithDevotion(47.5, { exempt: true })).toBe(50);
  });
  it('needs assessments to add up to 95 when devotion counts', () => {
    const c = (w: number) => ({ id: String(w), kind: 'CONTINUOUS' as const, weight: w, maxScore: 100 });
    expect(weightsProblem([c(35), c(60)], 95)).toBeNull();
    expect(weightsProblem([c(40), c(60)], 95)).toMatch('exactly 95%');
    expect(weightsProblem([c(40), c(60)])).toBeNull();
  });
  it('keeps the devotion part when an amendment regrades', () => {
    const bands = [{ letter: 'A', minScore: 80, gradePoint: 4, isPass: true }, { letter: 'B', minScore: 70, gradePoint: 3, isPass: true }, { letter: 'F', minScore: 0, gradePoint: 0, isPass: false }];
    expect(amendedResult(30, 46, bands, { score: 4 })).toMatchObject({ total: 80, grade: 'A' });
    expect(amendedResult(30, 46, bands, { exempt: true })).toMatchObject({ total: 80, grade: 'A' });
    expect(amendedResult(30, 46, bands)).toMatchObject({ total: 76, grade: 'B' });
  });
});
