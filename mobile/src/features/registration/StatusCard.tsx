import type { MyRegistration } from '@/api/registration';
import { Notice } from '@/components/states/Notice';

/** Where the registration stands, and the reviewer's note if it came back. */
export function StatusCard({ reg }: { reg: NonNullable<MyRegistration['registration']> }) {
  if (reg.status === 'APPROVED') return <Notice tone="success" title="Approved">Your courses are confirmed{reg.reference ? ` (reference ${reg.reference})` : ''}. They are now on your timetable and class lists.</Notice>;
  if (reg.status === 'SUBMITTED') return <Notice tone="info" title="Waiting for approval">Your advisor or department reviews it next. You can withdraw it to make changes until then.</Notice>;
  if (reg.status === 'REJECTED') return <Notice tone="warning" title="Returned for changes">{reg.reviewNote ? `Note from the reviewer: ${reg.reviewNote}` : 'Change your courses and submit again.'}</Notice>;
  return <Notice tone="info" title="Not submitted yet">Your choices are saved as a draft. Submit when you are ready.</Notice>;
}
