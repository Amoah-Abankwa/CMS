/**
 * Pure attendance rules shared by backend and frontend.
 * Late counts as attended. Excused sessions are left out entirely, so they never lower a percentage.
 */

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';

export interface AttendancePolicy {
  /** Minimum percentage of classes a student must attend. */
  minimumPercent: number;
  /** Self check-in after this many minutes from the start is recorded as late. */
  lateAfterMinutes: number;
  /** How long a check-in stays open by default. */
  checkInMinutes: number;
  /** Warn a student only after this many classes, so one early absence does not trigger an alert. */
  warnAfterSessions: number;
}

export const DEFAULT_ATTENDANCE_POLICY: AttendancePolicy = {
  minimumPercent: 75,
  lateAfterMinutes: 15,
  checkInMinutes: 20,
  warnAfterSessions: 3,
};

export function summariseAttendance(statuses: AttendanceStatus[]) {
  const present = statuses.filter((s) => s === 'PRESENT').length;
  const late = statuses.filter((s) => s === 'LATE').length;
  const absent = statuses.filter((s) => s === 'ABSENT').length;
  const excused = statuses.filter((s) => s === 'EXCUSED').length;
  const counted = present + late + absent;
  return {
    present,
    late,
    absent,
    excused,
    counted,
    /** Null until at least one class counts. */
    percent: counted === 0 ? null : Math.round(((present + late) / counted) * 1000) / 10,
  };
}

export function belowMinimum(percent: number | null, minimum: number) {
  return percent !== null && percent < minimum;
}

/** Self check-in status: late if the student arrives after the grace period. */
export function checkInStatus(classStart: Date, at: Date, lateAfterMinutes: number): 'PRESENT' | 'LATE' {
  return at.getTime() - classStart.getTime() > lateAfterMinutes * 60_000 ? 'LATE' : 'PRESENT';
}
