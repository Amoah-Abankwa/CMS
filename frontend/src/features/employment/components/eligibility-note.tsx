import type { WorkEligibility } from '@anu/shared';
import { Alert } from '@/components/ui/alert';

/** Why a student can or cannot apply, in plain words. */
export function EligibilityNote({ eligibility, cgpa }: { eligibility: WorkEligibility; cgpa?: number | null }) {
  if (eligibility.eligible) {
    return <Alert tone="success">{cgpa !== undefined ? (cgpa === null ? 'You have no published results yet, which is fine.' : `Your CGPA is ${cgpa.toFixed(2)}.`) : ''} You can apply.</Alert>;
  }
  return (
    <Alert tone="warning" title="You cannot apply yet">
      <ul className="list-disc pl-4">{eligibility.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
    </Alert>
  );
}
