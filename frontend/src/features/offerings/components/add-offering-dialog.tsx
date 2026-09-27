'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { errorMessage } from '@/lib/axios';
import { offeringsApi, type CourseOption, type DepartmentOption } from '../api';

interface Props {
  open: boolean;
  semesterId: string;
  semesterLabel: string;
  departments: DepartmentOption[];
  initialDepartmentId?: string;
  onClose: () => void;
  onAdded: () => void;
}

export function AddOfferingDialog({ open, semesterId, semesterLabel, departments, initialDepartmentId, onClose, onAdded }: Props) {
  const [departmentId, setDepartmentId] = useState('');
  const [courses, setCourses] = useState<CourseOption[] | null>(null);
  const [courseId, setCourseId] = useState('');
  const [capacity, setCapacity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDepartmentId(initialDepartmentId ?? departments[0]?.id ?? '');
    setCourseId('');
    setCapacity('');
    setError(null);
  }, [open, initialDepartmentId, departments]);

  useEffect(() => {
    if (!open || !departmentId || !semesterId) return;
    setCourses(null);
    offeringsApi.courseOptions(semesterId, departmentId).then(setCourses).catch((err) => setError(errorMessage(err)));
  }, [open, departmentId, semesterId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return setError('Choose a course.');
    setBusy(true);
    setError(null);
    try {
      await offeringsApi.create(semesterId, courseId, capacity ? Number(capacity) : undefined);
      onAdded();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add a course" description={`Offer a course in ${semesterLabel}.`}>
      <form onSubmit={add} className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {departments.length > 1 && (
          <Field label="Department" htmlFor="add-dept">
            <Select id="add-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Course" htmlFor="add-course" hint={courses?.length === 0 ? 'Every course in this department is already offered this semester.' : undefined}>
          <Select id="add-course" value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={!courses?.length}>
            <option value="">{courses ? 'Choose a course' : 'Loading courses'}</option>
            {courses?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} {c.title} ({c.creditHours} credits, level {c.level}, semester {c.semesterNo})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Seat limit (optional)" htmlFor="add-capacity" hint="Leave empty for no limit.">
          <Input id="add-capacity" type="number" inputMode="numeric" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Add course
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
