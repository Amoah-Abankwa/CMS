import type { DevotionPolicy } from '@anu/shared';
import { WEEKDAY_NAMES } from '@anu/shared';

/** Plain-language rules, shown to students and staff alike. */
export function RulesSummary({ policy }: { policy: DevotionPolicy }) {
  const days = policy.days.map((d) => WEEKDAY_NAMES[d]).join(', ');
  const late = Math.round(policy.lateCredit * 100);
  return (
    <ul className="space-y-1 text-sm">
      <li>Every {days}, from {policy.startsAt} to {policy.endsAt}. Check-in opens at {policy.opensAt}.</li>
      <li><span className="font-medium">Early</span>: arrive before {policy.lateFrom}. Full marks for that service.</li>
      <li><span className="font-medium">Late</span>: arrive from {policy.lateFrom} to {policy.endsAt}. {late}% of the marks for that service.</li>
      <li><span className="font-medium">Absent</span>: not recorded by {policy.endsAt}. No marks.</li>
      <li>Excused absences (for example medical) are left out, so they never lower your score. Early every time gives {policy.totalMarks.toFixed(2)}.</li>
    </ul>
  );
}
