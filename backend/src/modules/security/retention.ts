/**
 * How long records are kept before the nightly clean-up removes them. ANU decides these (see
 * docs/SECURITY.md); the activity log is kept for good unless a period is set.
 */
export interface RetentionRules {
  /** In-app notifications that have been read. */
  notificationsDays: number;
  /** Copies of emails and text messages sent (the notification itself stays until the rule above). */
  deliveriesDays: number;
  /** Online payment attempts that never completed. */
  abandonedPaymentsDays: number;
  /** Activity log entries; null keeps them for good. */
  activityLogYears: number | null;
}
export const DEFAULT_RETENTION: RetentionRules = { notificationsDays: 365, deliveriesDays: 180, abandonedPaymentsDays: 90, activityLogYears: null };
export const RETENTION_KEY = 'security.retention';

export function retentionProblems(r: RetentionRules): string[] {
  const p: string[] = [];
  if (!(r.notificationsDays >= 30 && r.notificationsDays <= 3650)) p.push('Keep read notifications between 30 days and 10 years.');
  if (!(r.deliveriesDays >= 30 && r.deliveriesDays <= 3650)) p.push('Keep sent messages between 30 days and 10 years.');
  if (!(r.abandonedPaymentsDays >= 30 && r.abandonedPaymentsDays <= 3650)) p.push('Keep abandoned payments between 30 days and 10 years.');
  if (r.activityLogYears !== null && !(r.activityLogYears >= 1 && r.activityLogYears <= 50)) p.push('Keep the activity log for at least a year, or for good.');
  return p;
}
