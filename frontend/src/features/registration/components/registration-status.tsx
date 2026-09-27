import { Alert } from '@/components/ui/alert';
import { formatDateTime } from '@/lib/format';
import type { MyRegistration } from '../api';

/** Explains where the registration stands and what the student should do next. */
export function RegistrationStatus({ data }: { data: MyRegistration }) {
  const reg = data.registration;
  const closes = data.semester.registrationClosesAt ? formatDateTime(data.semester.registrationClosesAt) : null;

  if (!data.semester.registrationOpen && reg?.status !== 'APPROVED') {
    return (
      <Alert tone="warning" title="Registration is not open">
        {data.semester.registrationOpensAt && new Date(data.semester.registrationOpensAt) > new Date()
          ? `It opens ${formatDateTime(data.semester.registrationOpensAt)}.`
          : 'The registration period has ended. Contact your department if you still need to register.'}
      </Alert>
    );
  }
  if (!reg || reg.status === 'DRAFT') {
    return (
      <Alert tone="info" title={reg ? 'Saved, not yet submitted' : 'Choose your courses'}>
        Tick your courses, then submit for approval{closes ? ` before ${closes}` : ''}. Saving keeps your choices without sending them.
      </Alert>
    );
  }
  if (reg.status === 'SUBMITTED') {
    return (
      <Alert tone="info" title="Waiting for approval">
        Submitted {reg.submittedAt ? formatDateTime(reg.submittedAt) : ''}. Your academic advisor or head of department will review it. You will get an email and SMS when they decide. Withdraw it if you need to make changes.
      </Alert>
    );
  }
  if (reg.status === 'APPROVED') {
    return (
      <Alert tone="success" title="Approved">
        Approved{reg.reviewedBy ? ` by ${reg.reviewedBy}` : ''}{reg.reviewedAt ? ` on ${formatDateTime(reg.reviewedAt)}` : ''}.
        {reg.reviewNote ? ` Note: ${reg.reviewNote}` : ''}
      </Alert>
    );
  }
  return (
    <Alert tone="danger" title="Returned for changes">
      {reg.reviewNote ?? 'Your department asked for changes.'} Update your courses and submit again{closes ? ` before ${closes}` : ''}.
    </Alert>
  );
}
