/** Student employment and dispatcher rules (Phase 8). Money in pesewas. */
import type { HoldCategory } from './exams';

export interface EmploymentRules {
  /** Minimum cumulative GPA for any campus job or dispatching. A job may ask for more. */
  minCgpa: number;
  /** Students with no published results yet (usually first-years) may apply. */
  allowNoResults: boolean;
  /** Campus jobs a student may hold at once. Dispatching does not count. */
  maxJobs: number;
  /** Paid to the dispatcher for each completed delivery, deducted from the vendor's settlement. */
  dispatchFee: number;
  /** Deliveries a dispatcher may carry at once. */
  maxActiveDeliveries: number;
  /** The vendor is alerted if no dispatcher takes a ready order within this many minutes. */
  dispatchWaitMinutes: number;
}

export const DEFAULT_EMPLOYMENT_RULES: EmploymentRules = {
  minCgpa: 2.5,
  allowNoResults: true,
  maxJobs: 1,
  dispatchFee: 400,
  maxActiveDeliveries: 2,
  dispatchWaitMinutes: 15,
};

export function validateEmploymentRules(r: EmploymentRules): string[] {
  const problems: string[] = [];
  if (!(r.minCgpa >= 0 && r.minCgpa <= 4)) problems.push('Minimum CGPA must be between 0.00 and 4.00.');
  if (!(r.maxJobs >= 1 && r.maxJobs <= 3)) problems.push('A student may hold 1 to 3 jobs at once.');
  if (!(r.dispatchFee >= 100 && r.dispatchFee <= 5000)) problems.push('The delivery fee must be between GH₵ 1.00 and GH₵ 50.00.');
  if (!(r.maxActiveDeliveries >= 1 && r.maxActiveDeliveries <= 5)) problems.push('A dispatcher may carry 1 to 5 deliveries at once.');
  if (!(r.dispatchWaitMinutes >= 5 && r.dispatchWaitMinutes <= 60)) problems.push('Alert the vendor after 5 to 60 minutes.');
  return problems;
}

/** Holds that stop a student working. Fee and administrative holds do not. */
export const BLOCKING_HOLDS: HoldCategory[] = ['DISCIPLINARY', 'ACADEMIC_MISCONDUCT'];

export interface WorkEligibilityInput {
  /** Cumulative GPA from published results, or null when there are none. */
  cgpa: number | null;
  /** Approved course registration this semester. */
  registered: boolean;
  /** Categories of holds still in place this semester. */
  holds: HoldCategory[];
  /** Jobs the student holds now (for a job application). */
  currentJobs?: number;
}

export interface WorkEligibility {
  eligible: boolean;
  /** Plain reasons, safe to show the student. Empty when eligible. */
  reasons: string[];
  requiredCgpa: number;
}

/**
 * Whether a student may work. `jobMinCgpa` is a single job's own minimum; the higher of that and the
 * university minimum applies. `forJob` also applies the limit on jobs held at once.
 */
export function checkEligibility(input: WorkEligibilityInput, rules: EmploymentRules, opts: { jobMinCgpa?: number | null; forJob?: boolean } = {}): WorkEligibility {
  const required = Math.max(rules.minCgpa, opts.jobMinCgpa ?? 0);
  const reasons: string[] = [];
  if (!input.registered) reasons.push('You need an approved course registration this semester.');
  if (input.cgpa === null) {
    if (!rules.allowNoResults) reasons.push('You need published results before you can apply.');
  } else if (input.cgpa + 1e-9 < required) {
    reasons.push(`A CGPA of at least ${required.toFixed(2)} is needed. Yours is ${input.cgpa.toFixed(2)}.`);
  }
  if (input.holds.some((h) => BLOCKING_HOLDS.includes(h))) reasons.push('A disciplinary hold is in place. Contact the Dean of Students office.');
  if (opts.forJob && (input.currentJobs ?? 0) >= rules.maxJobs) {
    reasons.push(rules.maxJobs === 1 ? 'You already have a campus job.' : `You already have ${rules.maxJobs} campus jobs.`);
  }
  return { eligible: reasons.length === 0, reasons, requiredCgpa: required };
}

export type JobPayUnit = 'HOUR' | 'MONTH' | 'TASK';
export const PAY_UNIT_LABEL: Record<JobPayUnit, string> = { HOUR: 'an hour', MONTH: 'a month', TASK: 'a task' };

export type ApplicationStatus = 'SUBMITTED' | 'SHORTLISTED' | 'HIRED' | 'REJECTED' | 'WITHDRAWN' | 'ENDED';
export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Applied',
  SHORTLISTED: 'Shortlisted',
  HIRED: 'Hired',
  REJECTED: 'Not successful',
  WITHDRAWN: 'Withdrawn',
  ENDED: 'Finished',
};

/** Which decisions Career Services can make on an application in each status. */
export function canDecide(from: ApplicationStatus, to: ApplicationStatus): boolean {
  const allowed: Record<ApplicationStatus, ApplicationStatus[]> = {
    SUBMITTED: ['SHORTLISTED', 'HIRED', 'REJECTED'],
    SHORTLISTED: ['HIRED', 'REJECTED'],
    HIRED: ['ENDED'],
    REJECTED: [],
    WITHDRAWN: [],
    ENDED: [],
  };
  return allowed[from].includes(to);
}

export type DispatcherStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED' | 'ENDED';
export const DISPATCHER_STATUS_LABEL: Record<DispatcherStatus, string> = {
  PENDING: 'Waiting for approval',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  REJECTED: 'Not approved',
  ENDED: 'Ended',
};

export type DeliveryStatus = 'WAITING' | 'ASSIGNED' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED';
export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  WAITING: 'Waiting for a dispatcher',
  ASSIGNED: 'Dispatcher on the way to the vendor',
  PICKED_UP: 'On the way to the customer',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

/** Hall or area only, for the list of available deliveries; the full address shows once taken. */
export function deliveryArea(address: string | null) {
  if (!address) return 'Campus';
  return address.split(/[,(]/)[0].replace(/\broom\b.*$/i, '').trim() || 'Campus';
}

// ----- Opportunities -----

export type JobKind = 'CAMPUS_JOB' | 'INTERNSHIP' | 'TEACHING_ASSISTANT' | 'RESEARCH_ASSISTANT';
export const JOB_KIND_LABEL: Record<JobKind, string> = {
  CAMPUS_JOB: 'Campus job',
  INTERNSHIP: 'Internship',
  TEACHING_ASSISTANT: 'Teaching assistant',
  RESEARCH_ASSISTANT: 'Research assistant',
};

// ----- Timesheets -----

/** Hours a student may work in a week across all campus jobs, so work does not crowd out study. */
export const MAX_WORK_HOURS_PER_WEEK = 20;

/** Monday of the week a date falls in (YYYY-MM-DD), for weekly limits. */
export function weekOf(date: string | Date) {
  const d = new Date(typeof date === 'string' ? `${date.slice(0, 10)}T00:00:00Z` : date);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/**
 * What a timesheet pays: hours times the hourly rate, tasks times the task rate, or the monthly amount.
 * Quantities are hours (to the quarter hour) or tasks.
 */
export function timesheetAmount(payUnit: JobPayUnit, rate: number, entries: Array<{ quantity: number }>) {
  if (payUnit === 'MONTH') return rate;
  const total = entries.reduce((t, e) => t + e.quantity, 0);
  return Math.round(total * rate);
}

/**
 * Problems with hours logged: more than the job's weekly hours in any week, or more than the campus
 * weekly limit counting the student's other jobs. `otherHours` maps a week (Monday) to hours already
 * logged on other jobs that week.
 */
export function hoursProblems(entries: Array<{ date: string; quantity: number }>, jobHoursPerWeek: number, otherHours: Record<string, number> = {}) {
  const weeks = new Map<string, number>();
  for (const e of entries) weeks.set(weekOf(e.date), (weeks.get(weekOf(e.date)) ?? 0) + e.quantity);
  const problems: string[] = [];
  for (const [week, hours] of weeks) {
    if (hours > jobHoursPerWeek + 1e-9) problems.push(`Week of ${week}: ${hours} hours is more than this job's ${jobHoursPerWeek} hours a week.`);
    const all = hours + (otherHours[week] ?? 0);
    if (all > MAX_WORK_HOURS_PER_WEEK + 1e-9) problems.push(`Week of ${week}: ${all} hours across your jobs is more than the ${MAX_WORK_HOURS_PER_WEEK}-hour weekly limit.`);
  }
  for (const e of entries) {
    if (!(e.quantity > 0) || e.quantity > 12 || Math.round(e.quantity * 4) !== e.quantity * 4) problems.push(`${e.date}: enter between 0.25 and 12 hours, in quarter hours.`);
  }
  return problems;
}

export type TimesheetStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RETURNED' | 'PAID';
export const TIMESHEET_STATUS_LABEL: Record<TimesheetStatus, string> = { DRAFT: 'Not sent', SUBMITTED: 'Waiting for approval', APPROVED: 'Approved, waiting for payment', RETURNED: 'Returned for changes', PAID: 'Paid' };
