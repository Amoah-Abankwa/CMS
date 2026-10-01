/**
 * The academic calendar and curriculum stages.
 *
 * Each academic year has three terms: Fall (September to December), Spring (January to May) and Summer
 * (June to August), stored as semester numbers 1, 2 and 3. Regular students (Bachelor's and Diploma)
 * study in Fall and Spring; Summer is optional and the academic office makes each one either
 * promotional (courses failed or not yet taken) or upgrade (any course, to improve the grade). Weekend
 * students have compulsory classes in all three terms.
 *
 * A programme's curriculum is set out in stages ("semester 1" to "semester 8" of a Bachelor's degree):
 * two a year for regular programmes, three a year for weekend programmes.
 */

export type Term = 'FALL' | 'SPRING' | 'SUMMER';
export type SummerKind = 'PROMOTIONAL' | 'UPGRADE';
export const TERM_BY_NUMBER: Record<number, Term> = { 1: 'FALL', 2: 'SPRING', 3: 'SUMMER' };
export const TERM_NAME: Record<Term, string> = { FALL: 'Fall', SPRING: 'Spring', SUMMER: 'Summer' };
export const SUMMER_KIND_LABEL: Record<SummerKind, string> = { PROMOTIONAL: 'Promotional summer', UPGRADE: 'Upgrade summer' };

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

/** The stage a student is most likely starting this term, from their current level. */
export function suggestedStage(currentLevel: number, termNumber: number, weekend: boolean, totalStages: number) {
  const inYear = weekend ? termNumber : termNumber === 2 ? 2 : 1;
  return Math.max(1, Math.min(totalStages, (Math.floor(currentLevel / 100) - 1) * stagesPerYear(weekend) + inYear));
}

export type RegistrationMode = 'REGULAR' | SummerKind | 'SUMMER_NOT_SET';

/** How a student registers this term: by main semester, or (regular students in summer) by summer type. */
export function registrationMode(termNumber: number, weekend: boolean, summerKind: SummerKind | null): RegistrationMode {
  if (termNumber !== 3 || weekend) return 'REGULAR';
  return summerKind ?? 'SUMMER_NOT_SET';
}

/**
 * Whether a curriculum course can be registered. Regular registration: any course up to the main
 * semester. Promotional summer: courses failed or not yet taken, up to the stage reached. Upgrade
 * summer: any course up to the stage reached.
 */
export function courseOpen(mode: RegistrationMode, stage: number, limitStage: number, passed: boolean) {
  if (mode === 'SUMMER_NOT_SET' || stage > limitStage) return false;
  if (mode === 'PROMOTIONAL') return !passed;
  return true;
}
