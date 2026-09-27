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
