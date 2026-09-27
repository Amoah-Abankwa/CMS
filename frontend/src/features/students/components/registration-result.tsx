import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import type { RegisteredStudent } from '../api';

export function RegistrationResult({ student, onAnother }: { student: RegisteredStudent; onAnother: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <Alert tone="success" title="Student registered">
        A link to set up their password has been emailed to {student.email}, and their index number sent by SMS to {student.phone}. The link expires in 72 hours.
      </Alert>
      <div className="rounded-md border border-border px-4 py-4">
        <p className="text-sm text-muted">
          {student.firstName} {student.lastName}
        </p>
        <p className="mt-1 text-sm text-muted">Index number</p>
        <p className="font-mono text-3xl font-semibold tracking-wide text-text">{student.indexNumber}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onAnother}>Register another student</Button>
        <Link href="/students" className="inline-flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-surface-muted">
          View all students
        </Link>
      </div>
    </div>
  );
}
