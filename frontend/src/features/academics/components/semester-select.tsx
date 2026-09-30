'use client';

import { Select } from '@/components/ui/input';
import type { Semester } from '../api';

/** Semester picker. An empty value means "the current semester". */
export function SemesterSelect({ semesters, value, onChangeAction, id = 'semester' }: { semesters: Semester[]; value: string; onChangeAction: (id: string) => void; id?: string }) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        Semester
      </label>
      <Select id={id} value={value} onChange={(e) => onChangeAction(e.target.value)}>
        <option value="">Current semester</option>
        {semesters.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
            {s.isCurrent ? ' (current)' : ''}
          </option>
        ))}
      </Select>
    </>
  );
}
