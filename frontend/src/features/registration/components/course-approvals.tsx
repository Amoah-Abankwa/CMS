'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { api, errorMessage } from '@/lib/axios';
import { formatDate } from '@/lib/format';

interface Approval { id: string; reason: string; createdAt: string; student: { firstName: string; lastName: string; indexNumber: string | null }; course: { code: string; title: string; creditHours: number } }

/** Advisors, Heads of Department and the Registry approve a course outside a student's programme, for this term. */
export function CourseApprovals() {
  const [rows, setRows] = useState<Approval[]>([]);
  const [f, setF] = useState({ indexNumber: '', courseCode: '', reason: '' });
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const load = useCallback(() => { api.get<Approval[]>('/registrations/course-approvals').then((r) => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  const grant = () => api.post('/registrations/course-approvals', { ...f })
    .then(() => { setMsg({ tone: 'success', text: `${f.courseCode.toUpperCase()} approved for ${f.indexNumber.toUpperCase()} this term. It now shows on their registration.` }); setF({ indexNumber: '', courseCode: '', reason: '' }); load(); })
    .catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }));
  return (
    <Card>
      <CardHeader title="Courses outside a student's programme" description="Students only see their own programme's courses. Approve another course for one student, for this term." />
      <CardBody className="flex flex-col gap-3">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
          <Field label="Index number" htmlFor="ca-i"><Input id="ca-i" value={f.indexNumber} onChange={(e) => setF({ ...f, indexNumber: e.target.value })} /></Field>
          <Field label="Course code" htmlFor="ca-c"><Input id="ca-c" value={f.courseCode} placeholder="MGT 201" onChange={(e) => setF({ ...f, courseCode: e.target.value })} /></Field>
          <Field label="Reason" htmlFor="ca-r"><Input id="ca-r" value={f.reason} maxLength={300} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
          <Button disabled={f.indexNumber.trim().length < 6 || f.courseCode.trim().length < 5 || f.reason.trim().length < 5} onClick={grant}>Approve</Button>
        </div>
        {rows.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border">
            {rows.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>{a.student.firstName} {a.student.lastName} <span className="text-muted">{a.student.indexNumber}: {a.course.code} {a.course.title}. {a.reason}. {formatDate(a.createdAt)}</span></span>
                <Button variant="ghost" size="sm" onClick={() => api.delete(`/registrations/course-approvals/${a.id}`).then(load)}>Remove</Button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
