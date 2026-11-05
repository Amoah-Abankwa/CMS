import { courseOpen, levelOfStage, registrationMode, stageOf, suggestedStage, termName } from '@anu/shared';

describe('terms and curriculum stages', () => {
  it('names the terms', () => {
    expect([1, 2, 3].map(termName)).toEqual(['Fall', 'Spring', 'Summer']);
  });
  it('numbers stages two a year for regular programmes and three for weekend ones', () => {
    expect(stageOf(300, 1, false)).toBe(5);
    expect(stageOf(400, 2, false)).toBe(8);
    expect(stageOf(200, 3, true)).toBe(6);
    expect(levelOfStage(5, false)).toBe(300);
    expect(levelOfStage(6, true)).toBe(200);
  });
  it('suggests the main semester from the level and term', () => {
    expect(suggestedStage(300, 1, false, 8)).toBe(5);
    expect(suggestedStage(300, 2, false, 8)).toBe(6);
    expect(suggestedStage(200, 3, true, 12)).toBe(6);
    expect(suggestedStage(500, 1, false, 8)).toBe(8);
  });
  it('registers regular students in summer by the summer type; weekend students as usual', () => {
    expect(registrationMode(1, false, null)).toBe('REGULAR');
    expect(registrationMode(3, true, 'UPGRADE')).toBe('REGULAR');
    expect(registrationMode(3, false, 'PROMOTIONAL')).toBe('PROMOTIONAL');
    expect(registrationMode(3, false, null)).toBe('SUMMER_NOT_SET');
  });
  it('opens courses up to the main semester, failed or untaken ones in a promotional summer', () => {
    expect(courseOpen('REGULAR', 3, 5, true)).toBe(true);
    expect(courseOpen('REGULAR', 6, 5, false)).toBe(false);
    expect(courseOpen('PROMOTIONAL', 3, 5, true)).toBe(false);
    expect(courseOpen('PROMOTIONAL', 3, 5, false)).toBe(true);
    expect(courseOpen('UPGRADE', 3, 5, true)).toBe(true);
    expect(courseOpen('SUMMER_NOT_SET', 1, 5, false)).toBe(false);
  });
});

import { missingPrerequisites, placeOfStage, prerequisiteLoop } from '@anu/shared';

describe('curriculum placement and prerequisites', () => {
  it('places a stage back in its level and semester', () => {
    expect(placeOfStage(5, false)).toEqual({ level: 300, semesterNo: 1 });
    expect(placeOfStage(8, false)).toEqual({ level: 400, semesterNo: 2 });
    expect(placeOfStage(6, true)).toEqual({ level: 200, semesterNo: 3 });
  });
  it('needs prerequisites taken before, with any grade', () => {
    const pre = [{ id: 'csc101', code: 'CSC 101' }, { id: 'mth101', code: 'MTH 101' }];
    expect(missingPrerequisites(pre, new Set(['csc101']))).toEqual(['MTH 101']);
    expect(missingPrerequisites(pre, new Set(['csc101', 'mth101']))).toEqual([]);
  });
  it('refuses prerequisite loops', () => {
    const edges = [{ courseId: 'b', prerequisiteId: 'a' }, { courseId: 'c', prerequisiteId: 'b' }];
    expect(prerequisiteLoop('a', 'c', edges)).toBe(true);
    expect(prerequisiteLoop('c', 'a', edges)).toBe(false);
    expect(prerequisiteLoop('a', 'a', [])).toBe(true);
  });
});

import { dropProblem } from '@anu/shared';

describe('dropping a course', () => {
  const now = new Date('2026-10-01T10:00:00Z');
  it('is allowed before the deadline, above the minimum credits', () => {
    expect(dropProblem({ deadline: '2026-10-15T23:59:00Z', now, creditsNow: 21, courseCredits: 3, minCredits: 12 })).toBeNull();
  });
  it('is refused after the deadline, without one, or below the minimum', () => {
    expect(dropProblem({ deadline: '2026-09-30T23:59:00Z', now, creditsNow: 21, courseCredits: 3, minCredits: 12 })).toMatch('passed');
    expect(dropProblem({ deadline: null, now, creditsNow: 21, courseCredits: 3, minCredits: 12 })).toMatch('not been opened');
    expect(dropProblem({ deadline: '2026-10-15T23:59:00Z', now, creditsNow: 14, courseCredits: 3, minCredits: 12 })).toMatch('below the minimum of 12');
  });
});
