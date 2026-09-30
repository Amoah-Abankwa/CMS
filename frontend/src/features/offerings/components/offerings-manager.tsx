'use client';

import { useCallback, useEffect, useState } from 'react';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { useSemesters } from '@/features/academics/use-semesters';
import { SemesterSelect } from '@/features/academics/components/semester-select';
import { RegistrationWindow } from '@/features/academics/components/registration-window';
import type { Semester } from '@/features/academics/api';
import { offeringsApi, type DepartmentOption, type LecturerOption, type Offering } from '../api';
import { AddOfferingDialog } from './add-offering-dialog';
import { OfferingDialog } from './offering-dialog';

export function OfferingsManager() {
  const { semesters } = useSemesters();
  const [semesterId, setSemesterId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [search, setSearch] = useState('');
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [lecturers, setLecturers] = useState<LecturerOption[]>([]);
  const [data, setData] = useState<{ semester: Semester; items: Offering[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState<Offering | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    offeringsApi.departments().then((d) => {
      setDepartments(d);
      if (d.length === 1) setDepartmentId(d[0].id);
    }).catch((err) => setError(errorMessage(err)));
    offeringsApi.lecturerOptions().then(setLecturers).catch(() => setLecturers([]));
  }, []);

  const load = useCallback(() => {
    setError(null);
    return offeringsApi
      .list({ semesterId: semesterId || undefined, departmentId: departmentId || undefined, search: search.trim() || undefined })
      .then((d) => {
        setData(d);
        setManaging((m) => (m ? d.items.find((o) => o.id === m.id) ?? null : null));
      })
      .catch((err) => setError(errorMessage(err)));
  }, [semesterId, departmentId, search]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(id);
  }, [load]);

  const offerAll = async () => {
    if (!data || !departmentId) return;
    setBulkBusy(true);
    setNotice(null);
    try {
      const r = await offeringsApi.createForDepartment(data.semester.id, departmentId);
      setNotice(r.created ? `${r.created} courses added.${r.alreadyOffered ? ` ${r.alreadyOffered} were already offered.` : ''}` : 'Every course for this semester is already offered.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBulkBusy(false);
    }
  };

  const unstaffed = data?.items.filter((o) => o.lecturers.length === 0).length ?? 0;
  const deptName = departments.find((d) => d.id === departmentId)?.name;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {semesters && <SemesterSelect semesters={semesters} value={semesterId} onChangeAction={setSemesterId} />}
        {departments.length > 1 && (
          <div>
            <label htmlFor="off-dept" className="sr-only">
              Department
            </label>
            <Select id="off-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">All my departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <label htmlFor="off-search" className="sr-only">
            Search courses
          </label>
          <Input id="off-search" type="search" placeholder="Search course code or title" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {data && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{data.semester.label}</span>
            <RegistrationWindow semester={data.semester} />
            {unstaffed > 0 && <Badge tone="warning">{unstaffed} without a lecturer</Badge>}
          </div>
          <div className="flex flex-wrap gap-2">
            {departmentId && (
              <Button variant="secondary" size="sm" loading={bulkBusy} onClick={offerAll}>
                Offer all {deptName} courses for this semester
              </Button>
            )}
            <Button size="sm" onClick={() => setAdding(true)} disabled={departments.length === 0}>
              Add a course
            </Button>
          </div>
        </div>
      )}

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      {!data && !error && <Spinner />}
      {data && data.items.length === 0 && (
        <EmptyState
          title="No courses offered yet"
          description={departmentId ? 'Add courses one at a time, or offer every course this department runs in this semester.' : 'Choose a department to offer all its courses at once, or add courses one at a time.'}
        />
      )}
      {data && data.items.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {data.items.map((o) => (
            <li key={o.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <span className="font-mono">{o.course.code}</span> {o.course.title}
                </p>
                <p className="text-xs text-muted">
                  {o.course.creditHours} credits, level {o.course.level}, {o.course.department.name}. {o.enrolled}
                  {o.capacity ? ` of ${o.capacity}` : ''} approved students.
                </p>
                <p className="mt-1 text-sm">
                  {o.lecturers.length === 0 ? (
                    <Badge tone="warning">No lecturer yet</Badge>
                  ) : (
                    o.lecturers.map((l) => l.name + (l.isLead && o.lecturers.length > 1 ? ' (lead)' : '')).join(', ')
                  )}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setManaging(o)}>
                Manage
              </Button>
            </li>
          ))}
        </ul>
      )}

      {data && (
        <AddOfferingDialog
          open={adding}
          semesterId={data.semester.id}
          semesterLabel={data.semester.label}
          departments={departments}
          initialDepartmentId={departmentId || undefined}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            setNotice('Course added.');
            void load();
          }}
        />
      )}
      <OfferingDialog offering={managing} lecturerOptions={lecturers} onClose={() => setManaging(null)} onChanged={() => void load()} />
    </div>
  );
}
