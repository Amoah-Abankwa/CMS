/**
 * The academic calendar and curriculum stages.
 *
 * Each academic year has three terms: Fall (September to December), Spring (January to May) and Summer
 * (June to August), stored as semester numbers 1, 2 and 3. Regular students (Bachelor's and Diploma)
 * study in Fall and Spring; Summer is optional and the academic office makes each one either
 * promotional (a regular semester: registered as in Fall and Spring) or upgrade (any course, to
 * improve the grade). Weekend
 * students have compulsory classes in all three terms.
 *
 * A programme's curriculum is set out in stages ("semester 1" to "semester 8" of a Bachelor's degree):
 * two a year for regular programmes, three a year for weekend programmes.
 */

export type Term = 'FALL' | 'SPRING' | 'SUMMER';
export type SummerKind = 'PROMOTIONAL' | 'UPGRADE';
export const TERM_BY_NUMBER: Record<number, Term> = { 1: 'FALL', 2: 'SPRING', 3: 'SUMMER' };
export const TERM_NAME: Record<Term, string> = { FALL: 'Fall', SPRING: 'Spring', SUMMER: 'Summer' };
export const SUMMER_KIND_LABEL: Record<SummerKind, string> = { PROMOTIONAL: 'Promotional summer', UPGRADE: 'Upgrade summer',  };

/** "Fall", "Spring" or "Summer" for a semester number. */
export function termName(n: number) {
  return TERM_NAME[TERM_BY_NUMBER[n] ?? 'FALL'] ?? `Term ${n}`;
}

/** The usual dates of each term in an academic year starting in `startYear`. */
export function termDates(startYear: number, n: number) {
  if (n === 1) return { startDate: `${startYear}-09-01`, endDate: `${startYear}-12-20` };
  if (n === 2) return { startDate: `${startYear + 1}-01-10`, endDate: `${startYear + 1}-05-31` };
  return { startDate: `${startYear + 1}-06-01`, endDate: `${startYear + 1}-08-31` };
}

/** Stages a year: three for weekend programmes (Fall, Spring, Summer), two otherwise. */
export const stagesPerYear = (weekend: boolean) => (weekend ? 3 : 2);

/** A curriculum entry's stage: level 300, semester 1 of a regular programme is stage 5. */
export function stageOf(level: number, semesterNo: number, weekend: boolean) {
  return (Math.floor(level / 100) - 1) * stagesPerYear(weekend) + semesterNo;
}

/** The level a stage belongs to: stage 5 of a regular programme is level 300. */
export function levelOfStage(stage: number, weekend: boolean) {
  return Math.ceil(stage / stagesPerYear(weekend)) * 100;
}

/**
 * The main semester to suggest: the one after the student's last approved main semester, or, for a
 * first registration, worked out from their level and the term (a regular summer counts as the first
 * semester of the next level).
 */
export function suggestedStage(currentLevel: number, termNumber: number, weekend: boolean, totalStages: number, lastApprovedStage?: number | null) {
  if (lastApprovedStage) return Math.max(1, Math.min(totalStages, lastApprovedStage + 1));
  const inYear = weekend ? termNumber : Math.min(termNumber, 3);
  return Math.max(1, Math.min(totalStages, (Math.floor(currentLevel / 100) - 1) * stagesPerYear(weekend) + inYear));
}

export type RegistrationMode = 'REGULAR' | 'UPGRADE' | 'SUMMER_NOT_SET';

/** How a student registers this term: by main semester, or (regular students in summer) by summer type. */
export function registrationMode(termNumber: number, weekend: boolean, summerKind: SummerKind | null): RegistrationMode {
  // A promotional summer is registered exactly like Fall and Spring.
  if (termNumber !== 3 || weekend || summerKind === 'PROMOTIONAL') return 'REGULAR';
  return summerKind ?? 'SUMMER_NOT_SET';
}

/**
 * Whether a curriculum course can be registered. Regular registration (Fall, Spring, a promotional
 * summer, and every term for weekend students): any course up to the main semester. Upgrade summer:
 * any course up to the stage reached.
 */
export function courseOpen(mode: RegistrationMode, stage: number, limitStage: number, _passed: boolean) {
  if (mode === 'SUMMER_NOT_SET' || stage > limitStage) return false;
  return true;
}

/** Where a curriculum stage sits within its level: stage 5 of a regular programme is level 300, semester 1. */
export function placeOfStage(stage: number, weekend: boolean) {
  const per = stagesPerYear(weekend);
  const level = levelOfStage(stage, weekend);
  return { level, semesterNo: stage - (level / 100 - 1) * per };
}

/**
 * Prerequisites not yet met: a course's prerequisites count as met once the student has taken them
 * before, with any grade (a pass is not required). Returns the codes still missing.
 */
export function missingPrerequisites(prerequisites: Array<{ id: string; code: string }>, taken: Set<string>) {
  return prerequisites.filter((p) => !taken.has(p.id)).map((p) => p.code);
}

/** Whether making `prereqId` a prerequisite of `courseId` would create a loop (A needs B needs A). */
export function prerequisiteLoop(courseId: string, prereqId: string, edges: Array<{ courseId: string; prerequisiteId: string }>) {
  if (courseId === prereqId) return true;
  const needs = new Map<string, string[]>();
  for (const e of edges) needs.set(e.courseId, [...(needs.get(e.courseId) ?? []), e.prerequisiteId]);
  const seen = new Set<string>();
  const stack = [prereqId];
  while (stack.length) {
    const c = stack.pop()!;
    if (c === courseId) return true;
    if (seen.has(c)) continue;
    seen.add(c);
    stack.push(...(needs.get(c) ?? []));
  }
  return false;
}

/**
 * Whether a registered course can be asked to be dropped: before the semester's drop deadline, and
 * leaving at least the minimum credits. Returns a reason, or null if fine.
 */
export function dropProblem(o: { deadline: Date | string | null; now: Date; creditsNow: number; courseCredits: number; minCredits: number }) {
  if (!o.deadline) return 'Dropping courses has not been opened for this semester.';
  if (o.now.getTime() > new Date(o.deadline).getTime()) return 'The deadline for dropping courses has passed.';
  if (o.creditsNow - o.courseCredits < o.minCredits) return `Dropping it would leave ${o.creditsNow - o.courseCredits} credits, below the minimum of ${o.minCredits}.`;
  return null;
}
