'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/axios';
import { cn } from '@/lib/cn';

interface Course { id: string; code: string; title: string; creditHours: number; description: string | null; isActive: boolean; department: { id: string; name: string; code: string }; prerequisites: Array<{ id: string; code: string; title: string }>; _count: { curriculum: number; offerings: number } }
interface Programme { id: string; code: string; name: string; level: { name: string; semesters: number }; _count: { curriculum: number } }
interface Curriculum { programme: { id: string; code: string; name: string; type: string; department: string; totalStages: number; weekend: boolean }; entries: Array<{ stage: number; isElective: boolean; course: { id: string; code: string; title: string; creditHours: number; isActive: boolean; prerequisites: string[] } }> }

/** Courses and programme curricula, for staff with the curriculum permission. */
export function CurriculumManager() {
  const [tab, setTab] = useState<'courses' | 'programmes'>('programmes');
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Curriculum" className="flex gap-2">
        {([['programmes', 'Programme curriculum'], ['courses', 'Courses']] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('rounded-md border px-3 py-1.5 text-sm', tab === k ? 'border-primary bg-primary text-white' : 'border-border hover:bg-surface-muted')}>{label}</button>
        ))}
      </div>
      {tab === 'courses' ? <Courses /> : <ProgrammeCurriculum />}
    </div>
  );
}

function useCourses() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const load = useCallback(() => { api.get<Course[]>('/curriculum/courses').then((r) => setCourses(r.data)).catch(() => setCourses([])); }, []);
  useEffect(() => { load(); }, [load]);
  return { courses, load };
}

function Courses() {
  const { courses, load } = useCourses();
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Course | 'new' | null>(null);
  const [prereqFor, setPrereqFor] = useState<Course | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  useEffect(() => { api.get<Array<{ id: string; name: string }>>('/curriculum/departments').then((r) => setDepartments(r.data)).catch(() => undefined); }, []);
  if (!courses) return <Spinner />;
  const q = search.trim().toLowerCase();
  const shown = courses.filter((c) => !q || `${c.code} ${c.title} ${c.department.name}`.toLowerCase().includes(q));
  const remove = (c: Course) => {
    if (!window.confirm(c._count.offerings ? `${c.code} has been taught, so it will be deactivated (kept for students' records), not deleted. Continue?` : `Delete ${c.code}?`)) return;
    api.delete<{ deleted: boolean }>(`/curriculum/courses/${c.id}`).then((r) => { setMsg({ tone: 'success', text: r.data.deleted ? `${c.code} deleted.` : `${c.code} deactivated.` }); load(); }).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }));
  };
  return (
    <Card>
      <CardHeader title={`Courses (${courses.length})`} description="Every course the university teaches, with the department that teaches it and any prerequisites (courses that must have been taken before, with any grade)." actions={<Button size="sm" onClick={() => setEditing('new')}>Add course</Button>} />
      <CardBody className="flex flex-col gap-3">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <Input aria-label="Find a course" placeholder="Code, title or department" value={search} onChange={(e) => setSearch(e.target.value)} className="w-72" />
        {shown.length === 0 ? <EmptyState title="No courses" /> : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {shown.slice(0, 300).map((c) => (
              <li key={c.id} className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span><span className="font-mono font-medium">{c.code}</span> {c.title} {!c.isActive && <Badge>inactive</Badge>}<span className="block text-xs text-muted">{c.department.name}, {c.creditHours} credits. In {c._count.curriculum} programme{c._count.curriculum === 1 ? '' : 's'}.{c.prerequisites.length ? ` Needs ${c.prerequisites.map((p) => p.code).join(', ')}.` : ''}</span></span>
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => setPrereqFor(c)}>Prerequisites</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(c)}>{c._count.offerings ? 'Deactivate' : 'Delete'}</Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      {editing && <CourseDialog course={editing === 'new' ? null : editing} departments={departments} onClose={() => setEditing(null)} onSaved={(t) => { setEditing(null); setMsg({ tone: 'success', text: t }); load(); }} />}
      {prereqFor && <PrerequisitesDialog course={prereqFor} all={courses} onClose={() => setPrereqFor(null)} onSaved={() => { setPrereqFor(null); setMsg({ tone: 'success', text: `Prerequisites saved for ${prereqFor.code}.` }); load(); }} />}
    </Card>
  );
}

function CourseDialog({ course, departments, onClose, onSaved }: { course: Course | null; departments: Array<{ id: string; name: string }>; onClose: () => void; onSaved: (t: string) => void }) {
  const [f, setF] = useState({ code: course?.code ?? '', title: course?.title ?? '', creditHours: String(course?.creditHours ?? 3), departmentId: course?.department.id ?? '', description: course?.description ?? '', isActive: course?.isActive ?? true });
  const [error, setError] = useState<string | null>(null);
  const save = () => (course ? api.patch(`/curriculum/courses/${course.id}`, { ...f, creditHours: Number(f.creditHours) }) : api.post('/curriculum/courses', { ...f, creditHours: Number(f.creditHours) }))
    .then(() => onSaved(course ? `${f.code.toUpperCase()} saved.` : `${f.code.toUpperCase()} added. Place it in a programme's curriculum next.`)).catch((err) => setError(errorMessage(err)));
  return (
    <Dialog open onClose={onClose} title={course ? `Edit ${course.code}` : 'Add a course'}>
      <div className="flex flex-col gap-3">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <Field label="Code" htmlFor="cd-c"><Input id="cd-c" value={f.code} placeholder="CSC 101" maxLength={12} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
          <Field label="Title" htmlFor="cd-t"><Input id="cd-t" value={f.title} maxLength={150} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <Field label="Credit hours" htmlFor="cd-h"><Input id="cd-h" type="number" min={0} max={12} value={f.creditHours} onChange={(e) => setF({ ...f, creditHours: e.target.value })} /></Field>
          <Field label="Taught by" htmlFor="cd-d"><Select id="cd-d" value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value })}><option value="">Choose a department</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
        </div>
        <Field label="Description (optional)" htmlFor="cd-x"><Textarea id="cd-x" value={f.description} maxLength={1000} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        {course && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> Active (students can register it)</label>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={f.code.trim().length < 5 || f.title.trim().length < 3 || !f.departmentId} onClick={save}>Save</Button></div>
      </div>
    </Dialog>
  );
}

function PrerequisitesDialog({ course, all, onClose, onSaved }: { course: Course; all: Course[]; onClose: () => void; onSaved: () => void }) {
  const [chosen, setChosen] = useState<string[]>(course.prerequisites.map((p) => p.id));
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const options = all.filter((c) => c.id !== course.id && (!q.trim() || `${c.code} ${c.title}`.toLowerCase().includes(q.trim().toLowerCase()))).slice(0, 40);
  return (
    <Dialog open onClose={onClose} title={`Prerequisites of ${course.code}`} description="A student can register this course once they have taken each of these before, with any grade.">
      <div className="flex flex-col gap-3">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex flex-wrap gap-2">{chosen.length === 0 ? <span className="text-sm text-muted">None.</span> : chosen.map((id) => { const c = all.find((x) => x.id === id); return <button key={id} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-muted" onClick={() => setChosen(chosen.filter((x) => x !== id))}>{c?.code ?? id} (remove)</button>; })}</div>
        <Input aria-label="Find a course" placeholder="Find a course to add" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="max-h-56 overflow-y-auto rounded-md border border-border text-sm">
          {options.map((c) => <li key={c.id}><button className="w-full px-3 py-1.5 text-left hover:bg-surface-muted disabled:opacity-50" disabled={chosen.includes(c.id)} onClick={() => setChosen([...chosen, c.id])}><span className="font-mono">{c.code}</span> {c.title}</button></li>)}
        </ul>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => api.put(`/curriculum/courses/${course.id}/prerequisites`, { prerequisiteIds: chosen }).then(onSaved).catch((err) => setError(errorMessage(err)))}>Save</Button></div>
      </div>
    </Dialog>
  );
}

function ProgrammeCurriculum() {
  const [programmes, setProgrammes] = useState<Programme[] | null>(null);
  const [id, setId] = useState('');
  const [data, setData] = useState<Curriculum | null>(null);
  const { courses } = useCourses();
  const [add, setAdd] = useState({ stage: '1', courseId: '', isElective: false, q: '' });
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  useEffect(() => { api.get<Programme[]>('/curriculum/programmes').then((r) => { setProgrammes(r.data); setId(r.data[0]?.id ?? ''); }).catch(() => setProgrammes([])); }, []);
  useEffect(() => { if (id) { setData(null); api.get<Curriculum>(`/curriculum/programmes/${id}`).then((r) => setData(r.data)).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); } }, [id]);
  const stages = useMemo(() => (data ? Array.from({ length: data.programme.totalStages }, (_, i) => i + 1) : []), [data]);
  if (!programmes) return <Spinner />;
  if (!programmes.length) return <EmptyState title="No programmes" description="Add programmes under Academic structure first." />;
  const place = (courseId: string, stage: number, isElective: boolean) => api.put<Curriculum>(`/curriculum/programmes/${id}/courses`, { courseId, stage, isElective }).then((r) => { setData(r.data); setMsg(null); }).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }));
  const options = (courses ?? []).filter((c) => c.isActive && !data?.entries.some((e) => e.course.id === c.id) && (!add.q.trim() || `${c.code} ${c.title}`.toLowerCase().includes(add.q.trim().toLowerCase()))).slice(0, 30);
  return (
    <Card>
      <CardHeader title="Programme curriculum" description="Place each course in a semester of the programme, as core or elective. Students see only their own programme's courses: their main semester's, and those of the semesters below it." actions={<Select aria-label="Programme" className="w-80" value={id} onChange={(e) => setId(e.target.value)}>{programmes.map((p) => <option key={p.id} value={p.id}>{p.name} ({p._count.curriculum})</option>)}</Select>} />
      <CardBody className="flex flex-col gap-4">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        {!data ? <Spinner /> : (
          <>
            <p className="text-sm text-muted">{data.programme.type}, {data.programme.department}. {data.programme.totalStages} semesters ({data.programme.weekend ? 'Fall, Spring and Summer each year' : 'Fall and Spring each year'}).</p>
            <div className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[8rem_2fr_auto_auto] sm:items-end">
              <Field label="Semester" htmlFor="pc-s"><Select id="pc-s" value={add.stage} onChange={(e) => setAdd({ ...add, stage: e.target.value })}>{stages.map((n) => <option key={n} value={n}>Semester {n}</option>)}</Select></Field>
              <Field label="Course" htmlFor="pc-q">
                <Input id="pc-q" placeholder="Find a course by code or title" value={add.q} onChange={(e) => setAdd({ ...add, q: e.target.value, courseId: '' })} />
              </Field>
              <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" className="size-4" checked={add.isElective} onChange={(e) => setAdd({ ...add, isElective: e.target.checked })} /> Elective</label>
              <Button disabled={!add.courseId} onClick={() => place(add.courseId, Number(add.stage), add.isElective).then(() => setAdd({ ...add, courseId: '', q: '' }))}>Add</Button>
              {add.q.trim() && !add.courseId && (
                <ul className="max-h-48 overflow-y-auto rounded-md border border-border text-sm sm:col-span-4">
                  {options.length === 0 ? <li className="px-3 py-2 text-muted">No matching course. Add it under Courses.</li> : options.map((c) => <li key={c.id}><button className="w-full px-3 py-1.5 text-left hover:bg-surface-muted" onClick={() => setAdd({ ...add, courseId: c.id, q: `${c.code} ${c.title}` })}><span className="font-mono">{c.code}</span> {c.title} <span className="text-muted">{c.creditHours} credits</span></button></li>)}
                </ul>
              )}
            </div>
            {stages.map((n) => {
              const rows = data.entries.filter((e) => e.stage === n);
              const credits = rows.reduce((t, e) => t + e.course.creditHours, 0);
              return (
                <section key={n}>
                  <h3 className="mb-1 text-sm font-semibold">Semester {n} <span className="font-normal text-muted">{rows.length} courses, {credits} credits</span></h3>
                  {rows.length === 0 ? <p className="text-xs text-muted">No courses yet.</p> : (
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {rows.map((e) => (
                        <li key={e.course.id} className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                          <span><span className="font-mono">{e.course.code}</span> {e.course.title} <span className="text-muted">{e.course.creditHours} credits{e.course.prerequisites.length ? `, needs ${e.course.prerequisites.join(', ')}` : ''}</span> {!e.course.isActive && <Badge>inactive</Badge>}</span>
                          <span className="flex items-center gap-1">
                            <Badge tone={e.isElective ? 'neutral' : 'primary'}>{e.isElective ? 'Elective' : 'Core'}</Badge>
                            <Button size="sm" variant="ghost" onClick={() => place(e.course.id, e.stage, !e.isElective)}>Make {e.isElective ? 'core' : 'elective'}</Button>
                            <Select aria-label="Move to semester" className="h-8 w-32" value={e.stage} onChange={(ev) => place(e.course.id, Number(ev.target.value), e.isElective)}>{stages.map((s) => <option key={s} value={s}>Semester {s}</option>)}</Select>
                            <Button size="sm" variant="ghost" onClick={() => api.delete<Curriculum>(`/curriculum/programmes/${id}/courses/${e.course.id}`).then((r) => setData(r.data)).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }))}>Remove</Button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </>
        )}
      </CardBody>
    </Card>
  );
}
