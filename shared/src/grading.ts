/**
 * Pure grading rules. No database access, so they are easy to test and reuse on the web.
 */

export interface Band {
  letter: string;
  minScore: number;
  gradePoint: number;
  isPass: boolean;
  remark?: string | null;
}

export interface Component {
  id: string;
  kind: 'CONTINUOUS' | 'EXAM';
  weight: number;
  maxScore: number;
}

export interface Mark {
  score: number | null;
  absent: boolean;
}

export const INCOMPLETE_GRADE = 'IC';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Returns the problems with a proposed scale, or an empty list if it is valid. */
export function validateScale(bands: Band[], passMark: number, maxGradePoint: number): string[] {
  const problems: string[] = [];
  if (bands.length < 2) problems.push('Add at least two grades.');
  const letters = bands.map((b) => b.letter.trim().toUpperCase());
  if (letters.some((l) => !/^[A-Z][A-Z+-]{0,2}$/.test(l))) problems.push('Grade letters must be 1 to 3 characters, such as A, B+ or C-.');
  if (letters.includes(INCOMPLETE_GRADE)) problems.push(`"${INCOMPLETE_GRADE}" is reserved for incomplete results.`);
  if (new Set(letters).size !== letters.length) problems.push('Each grade letter can only be used once.');
  const mins = bands.map((b) => b.minScore);
  if (new Set(mins).size !== mins.length) problems.push('Two grades cannot start at the same score.');
  if (mins.some((m) => m < 0 || m > 100)) problems.push('Minimum scores must be between 0 and 100.');
  if (!mins.includes(0)) problems.push('The lowest grade must start at 0 so every score gets a grade.');
  if (bands.some((b) => b.gradePoint < 0 || b.gradePoint > maxGradePoint)) problems.push(`Grade points must be between 0 and ${maxGradePoint}.`);
  if (passMark < 0 || passMark > 100) problems.push('The pass mark must be between 0 and 100.');

  const sorted = [...bands].sort((a, b) => b.minScore - a.minScore);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].gradePoint > sorted[i - 1].gradePoint) {
      problems.push(`${sorted[i].letter} starts lower than ${sorted[i - 1].letter} but has more grade points.`);
      break;
    }
  }
  const misflagged = sorted.find((b) => (b.minScore >= passMark) !== b.isPass);
  if (misflagged) problems.push(`${misflagged.letter} should be marked as ${misflagged.minScore >= passMark ? 'a pass' : 'a fail'} with a pass mark of ${passMark}.`);
  return problems;
}

export function gradeFor(total: number, bands: Band[]): Band {
  const sorted = [...bands].sort((a, b) => b.minScore - a.minScore);
  return sorted.find((b) => total >= b.minScore) ?? sorted[sorted.length - 1];
}

export function weightsProblem(components: Component[]): string | null {
  if (components.length === 0) return 'Add at least one assessment.';
  const sum = round2(components.reduce((s, c) => s + c.weight, 0));
  if (sum !== 100) return `The weights add up to ${sum}%. They must add up to exactly 100%.`;
  return null;
}

/**
 * Weighted total for one student. Each component contributes (score / maxScore) x weight.
 * The total is rounded to a whole number (half up) before grading.
 * Missing a continuous assessment counts as 0; being absent from an exam makes the result incomplete.
 */
export function computeTotal(components: Component[], marks: Map<string, Mark | undefined>) {
  let ca = 0;
  let exam = 0;
  let incomplete = false;
  let missing = 0;
  for (const c of components) {
    const m = marks.get(c.id);
    if (!m || (m.score === null && !m.absent)) missing++;
    if (m?.absent && c.kind === 'EXAM') incomplete = true;
    const contribution = m && m.score !== null && !m.absent ? (m.score / c.maxScore) * c.weight : 0;
    if (c.kind === 'EXAM') exam += contribution;
    else ca += contribution;
  }
  const caScore = round2(ca);
  const examScore = round2(exam);
  return { caScore, examScore, total: Math.round(caScore + examScore + 1e-9), incomplete, missing };
}

/** Grade-point average over results with credits. Incomplete results are left out. */
export function gpa(results: Array<{ credits: number; gradePoint: number; incomplete: boolean }>) {
  const counted = results.filter((r) => !r.incomplete);
  const credits = counted.reduce((s, r) => s + r.credits, 0);
  if (credits === 0) return { gpa: null as number | null, credits: 0 };
  const points = counted.reduce((s, r) => s + r.gradePoint * r.credits, 0);
  return { gpa: round2(points / credits), credits };
}
