'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Select, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/axios';

interface Data {
  advisors: Array<{ id: string; title: string | null; firstName: string; lastName: string; email: string | null; _count: { advisees: number } }>;
  students: Array<{ id: string; firstName: string; lastName: string; indexNumber: string | null; advisorId: string | null; studentProfile: { currentLevel: number; programme: { name: string } } | null }>;
}

/** Heads of Department and the Registry give each student their own academic advisor. */
export function AdvisorAssignments() {
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }> | null>(null);
  const [departmentId, setDepartmentId] = useState('');
  const [data, setData] = useState<Data | null>(null);
  const [advisorId, setAdvisorId] = useState('');
  const [indexes, setIndexes] = useState('');
  const [filter, setFilter] = useState<'all' | 'none' | string>('all');
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger' | 'warning'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get<Array<{ id: string; name: string }>>('/advisors/departments').then((r) => { setDepartments(r.data); setDepartmentId(r.data[0]?.id ?? ''); }).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }, []);
  const load = useCallback(() => { if (departmentId) api.get<Data>('/advisors', { params: { departmentId } }).then((r) => setData(r.data)).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }, [departmentId]);
  useEffect(() => { setData(null); load(); }, [load]);

  const assign = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = (await api.post<{ changed: number; notFound: string[] }>('/advisors/assign', { departmentId, advisorId: advisorId || null, indexNumbers: indexes.split(/[\s,;]+/).filter(Boolean) })).data;
      setMsg({ tone: r.notFound.length ? 'warning' : 'success', text: `${advisorId ? 'Assigned' : 'Removed the advisor for'} ${r.changed} students.${r.notFound.length ? ` Not students of this department: ${r.notFound.join(', ')}.` : ''}` });
      setIndexes('');
      load();
    } catch (err) { setMsg({ tone: 'danger', text: errorMessage(err) }); } finally { setBusy(false); }
  };

  if (!departments) return msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : <Spinner />;
  const name = (id: string | null) => { const a = data?.advisors.find((x) => x.id === id); return a ? `${a.title ?? ''} ${a.firstName} ${a.lastName}`.trim() : 'None'; };
  const shown = data?.students.filter((s) => filter === 'all' || (filter === 'none' ? !s.advisorId : s.advisorId === filter)) ?? [];
  return (
    <div className="flex flex-col gap-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Select aria-label="Department" className="w-72" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
      {!data ? <Spinner /> : (
        <>
          <Card>
            <CardHeader title="Assign students" description="An advisor with advisees reviews only their own students' course registrations. Students without an advisor are reviewed by any advisor of the department." />
            <CardBody className="flex flex-col gap-3">
              {data.advisors.length === 0 ? <Alert tone="warning">No staff member has the Academic Advisor role for this department yet. Give the role on the Staff screens first.</Alert> : (
                <>
                  <Field label="Advisor" htmlFor="adv-a"><Select id="adv-a" value={advisorId} onChange={(e) => setAdvisorId(e.target.value)}><option value="">No advisor (remove)</option>{data.advisors.map((a) => <option key={a.id} value={a.id}>{name(a.id)} ({a._count.advisees} advisees)</option>)}</Select></Field>
                  <Field label="Index numbers" htmlFor="adv-i" hint="Paste a list, separated by spaces, commas or new lines."><Textarea id="adv-i" value={indexes} onChange={(e) => setIndexes(e.target.value)} /></Field>
                  <div><Button loading={busy} disabled={!indexes.trim()} onClick={assign}>{advisorId ? 'Assign' : 'Remove advisor'}</Button></div>
                </>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={`Students (${data.students.length})`} actions={<Select aria-label="Show" className="w-56" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Everyone</option><option value="none">Without an advisor</option>{data.advisors.map((a) => <option key={a.id} value={a.id}>{name(a.id)}</option>)}</Select>} />
            {shown.length === 0 ? <CardBody><EmptyState title="Nobody here" /></CardBody> : (
              <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto">
                {shown.map((s) => (
                  <li key={s.id} className="flex flex-col gap-1 px-4 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <span>{s.firstName} {s.lastName} <span className="text-muted">{s.indexNumber}{s.studentProfile ? `, ${s.studentProfile.programme.name}, level ${s.studentProfile.currentLevel}` : ''}</span></span>
                    <span className="text-muted">{name(s.advisorId)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
