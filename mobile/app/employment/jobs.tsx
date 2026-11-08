import { useState } from 'react';
import { View } from 'react-native';
import { APPLICATION_STATUS_LABEL, formatCedis, PAY_UNIT_LABEL, type JobPayUnit } from '@anu/shared';
import { workApi, type AdminJob, type JobDetail } from '@/api/employment';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { validate } from '@/lib/validate';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

const STATUS = { DRAFT: ['Draft', 'neutral'], PENDING_REVIEW: ['Waiting for review', 'warning'], OPEN: ['Open', 'success'], CLOSED: ['Closed', 'neutral'] } as const;

export default function CampusJobs() {
  const q = useQuery<AdminJob[]>('emp.jobs', '/employment/jobs');
  const [editing, setEditing] = useState<AdminJob | 'new' | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Campus jobs" subtitle="Career Services: jobs, applicants and who is hired." />
      {editing ? <JobForm job={editing === 'new' ? null : editing} onDone={() => { setEditing(null); q.refresh(); }} /> : viewing ? <Applicants id={viewing} onBack={() => { setViewing(null); q.refresh(); }} /> : (
        <>
          <Button label="Post a job" onPress={() => setEditing('new')} />
          <QueryView q={q} skeleton={<SkeletonList rows={5} />}>
            {(list) => list.length === 0 ? <EmptyState title="No jobs yet" why="Post campus jobs here; students see open ones under Campus jobs." /> : <>{list.map((j) => <JobCard key={j.id} j={j} onEdit={() => setEditing(j)} onView={() => setViewing(j.id)} onChange={q.refresh} />)}</>}
          </QueryView>
        </>
      )}
    </Screen>
  );
}

function JobCard({ j, onEdit, onView, onChange }: { j: AdminJob; onEdit: () => void; onView: () => void; onChange: () => void }) {
  const { space } = useTheme();
  const { busy, error, run } = useSubmit();
  return (
    <Card>
      <Text variant="heading">{j.title}</Text>
      <Text variant="small" tone="muted">{j.unit}. {formatCedis(j.payRate)} {PAY_UNIT_LABEL[j.payUnit]}. {j.applicants} applied, {j.waiting} to look at, {j.hired} hired.</Text>
      <Badge label={STATUS[j.status][0]} tone={STATUS[j.status][1]} />
      <FormError error={error} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Button label="Applicants" variant="secondary" onPress={onView} />
        <Button label="Edit" variant="ghost" onPress={onEdit} />
        {j.status === 'OPEN' ? <Button label="Close" variant="ghost" loading={busy} onPress={() => void run(async () => { await workApi.setJobStatus(j.id, 'CLOSED'); onChange(); })} /> : <Button label="Open" variant="ghost" loading={busy} onPress={() => void run(async () => { await workApi.setJobStatus(j.id, 'OPEN'); onChange(); })} />}
      </View>
    </Card>
  );
}

function JobForm({ job, onDone }: { job: AdminJob | null; onDone: () => void }) {
  const { space } = useTheme();
  const [f, setF] = useState({ title: job?.title ?? '', unit: job?.unit ?? '', description: job?.description ?? '', hours: String(job?.hoursPerWeek ?? 8), pay: job ? String(job.payRate / 100) : '', payUnit: (job?.payUnit ?? 'HOUR') as JobPayUnit, positions: String(job?.positions ?? 1), minCgpa: job?.minCgpa != null ? String(job.minCgpa) : '', closesAt: job?.closesAt.slice(0, 10) ?? '', supervisorEmail: job?.supervisor?.email ?? '' });
  const [touched, setTouched] = useState(false);
  const { busy, error, run } = useSubmit();
  const errs = {
    title: f.title.trim().length >= 4 ? null : 'At least 4 characters.', unit: f.unit.trim().length >= 2 ? null : 'Which office the job is in.', description: f.description.trim().length >= 30 ? null : 'Describe the work in at least 30 characters.',
    hours: Number(f.hours) > 0 && Number(f.hours) <= 40 ? null : 'From 1 to 40 hours a week.', pay: Number(f.pay) > 0 ? null : 'Pay in cedis.', positions: Number.isInteger(Number(f.positions)) && Number(f.positions) >= 1 ? null : 'At least 1.',
    minCgpa: !f.minCgpa || (Number(f.minCgpa) >= 0 && Number(f.minCgpa) <= 4) ? null : 'From 0 to 4, or empty for the university minimum.', closesAt: /^\d{4}-\d{2}-\d{2}$/.test(f.closesAt) ? null : 'YYYY-MM-DD.', supervisor: f.supervisorEmail ? validate.email(f.supervisorEmail) : null,
  };
  const e = (k: keyof typeof errs) => (touched ? errs[k] : null);
  return (
    <Card>
      <Text variant="heading">{job ? 'Edit job' : 'Post a job'}</Text>
      <FormError error={error} />
      <TextField label="Title" value={f.title} onChangeText={(x) => setF({ ...f, title: x })} error={e('title')} />
      <TextField label="Office" value={f.unit} onChangeText={(x) => setF({ ...f, unit: x })} error={e('unit')} />
      <TextField label="What the work is" value={f.description} multiline onChangeText={(x) => setF({ ...f, description: x })} error={e('description')} />
      <TextField label="Hours a week" value={f.hours} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, hours: x })} error={e('hours')} />
      <TextField label="Pay (GH₵)" value={f.pay} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, pay: x })} error={e('pay')} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>{(['HOUR', 'MONTH', 'TASK'] as JobPayUnit[]).map((u) => <Chip key={u} label={PAY_UNIT_LABEL[u]} selected={f.payUnit === u} onPress={() => setF({ ...f, payUnit: u })} />)}</View>
      <TextField label="Places" value={f.positions} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, positions: x })} error={e('positions')} />
      <TextField label="Minimum CGPA (optional)" value={f.minCgpa} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, minCgpa: x })} error={e('minCgpa')} />
      <TextField label="Applications close" value={f.closesAt} placeholder="YYYY-MM-DD" onChangeText={(x) => setF({ ...f, closesAt: x })} error={e('closesAt')} />
      <TextField label="Supervisor's email (optional)" value={f.supervisorEmail} autoCapitalize="none" keyboardType="email-address" onChangeText={(x) => setF({ ...f, supervisorEmail: x })} error={e('supervisor')} />
      <Button label="Save" loading={busy} onPress={() => { setTouched(true); if (!Object.values(errs).some(Boolean)) void run(async () => { await workApi.saveJob({ title: f.title.trim(), unit: f.unit.trim(), description: f.description.trim(), hoursPerWeek: Number(f.hours), payRate: Math.round(Number(f.pay) * 100), payUnit: f.payUnit, positions: Number(f.positions), minCgpa: f.minCgpa ? Number(f.minCgpa) : null, closesAt: `${f.closesAt}T23:59:00.000Z`, supervisorEmail: f.supervisorEmail.trim() || undefined }, job?.id); onDone(); }); }} />
      <Button label="Cancel" variant="ghost" onPress={onDone} />
    </Card>
  );
}

function Applicants({ id, onBack }: { id: string; onBack: () => void }) {
  const { space } = useTheme();
  const q = useQuery<JobDetail>(`emp.job.${id}`, `/employment/jobs/${id}`);
  const { busy, error, run } = useSubmit();
  const decide = (aid: string, status: 'SHORTLISTED' | 'HIRED' | 'REJECTED') => void run(async () => { await workApi.decide(aid, { status, startDate: status === 'HIRED' ? new Date().toISOString().slice(0, 10) : undefined }); q.refresh(); });
  return (
    <>
      <Button label="Back to jobs" variant="ghost" onPress={onBack} />
      <FormError error={error} />
      <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
        {(j) => j.applications.length === 0 ? <EmptyState title="No applicants yet" why="Students who apply appear here." /> : <>{j.applications.map((a) => (
          <Card key={a.id}>
            <Text variant="label">{a.student.firstName} {a.student.lastName} <Text variant="small" tone="muted">{a.student.indexNumber}{a.cgpa != null ? `, CGPA ${a.cgpa.toFixed(2)}` : ''}</Text></Text>
            <Badge label={APPLICATION_STATUS_LABEL[a.status]} />
            <Text>{a.statement}</Text>
            {!a.eligibility.eligible ? <Text variant="small" tone="warning">{a.eligibility.reasons.join(' ')}</Text> : null}
            {a.status === 'SUBMITTED' || a.status === 'SHORTLISTED' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {a.status === 'SUBMITTED' ? <Button label="Shortlist" variant="secondary" loading={busy} onPress={() => decide(a.id, 'SHORTLISTED')} /> : null}
                <Button label="Hire" disabled={!a.eligibility.eligible} loading={busy} onPress={() => decide(a.id, 'HIRED')} />
                <Button label="Turn down" variant="ghost" loading={busy} onPress={() => decide(a.id, 'REJECTED')} />
              </View>
            ) : null}
          </Card>
        ))}</>}
      </QueryView>
    </>
  );
}
