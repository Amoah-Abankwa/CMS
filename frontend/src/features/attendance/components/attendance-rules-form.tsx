'use client';

import { useEffect, useState } from 'react';
import type { AttendancePolicy } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { attendanceApi } from '../api';

const FIELDS: Array<{ key: keyof AttendancePolicy; label: string; hint: string; unit: string }> = [
  { key: 'minimumPercent', label: 'Minimum attendance', hint: 'Needed to be eligible for a course exam, when that rule is on under Exam eligibility.', unit: '%' },
  { key: 'lateAfterMinutes', label: 'Late after', hint: 'Self check-in after this many minutes from the start is recorded as late. Late still counts as attended.', unit: 'minutes' },
  { key: 'checkInMinutes', label: 'Check-in stays open for', hint: 'Default length when a lecturer starts self check-in.', unit: 'minutes' },
  { key: 'warnAfterSessions', label: 'Warn students after', hint: 'Students below the minimum get one email and SMS once this many classes are recorded.', unit: 'classes' },
];

export function AttendanceRulesForm() {
  const [values, setValues] = useState<Record<keyof AttendancePolicy, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    attendanceApi
      .policy()
      .then((p) => setValues(Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])) as Record<keyof AttendancePolicy, string>))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (!values) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await attendanceApi.setPolicy(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)])) as unknown as AttendancePolicy);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="flex max-w-xl flex-col gap-4">
      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">Attendance rules saved. Recalculate exam eligibility to apply a new minimum.</Alert>}
      {FIELDS.map((f) => (
        <Field key={f.key} label={`${f.label} (${f.unit})`} htmlFor={`rule-${f.key}`} hint={f.hint}>
          <Input id={`rule-${f.key}`} type="number" inputMode="numeric" className="w-32" value={values[f.key]} onChange={(e) => { setValues({ ...values, [f.key]: e.target.value }); setSaved(false); }} />
        </Field>
      ))}
      <div><Button type="submit" loading={busy}>Save rules</Button></div>
    </form>
  );
}
