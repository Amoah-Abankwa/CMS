import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { registrationApi, type MyRegistration } from '@/api/registration';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { CourseOption } from '@/features/registration/CourseOption';
import { CreditBar } from '@/features/registration/CreditBar';
import { StagePicker } from '@/features/registration/StagePicker';
import { StatusCard } from '@/features/registration/StatusCard';
import { useDraft } from '@/hooks/useDraft';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { openPdf } from '@/lib/files';
import { useCache } from '@/stores/cache';
import { useTheme } from '@/theme/useTheme';

const KEY = 'me.registration';

export default function Registration() {
  const q = useQuery<MyRegistration>(KEY, '/me/registration');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Course registration" subtitle={q.data?.semester.label} />
      <QueryView q={q} skeleton={<SkeletonList rows={6} />}>{(d) => <Planner d={d} />}</QueryView>
    </Screen>
  );
}

function Planner({ d }: { d: MyRegistration }) {
  const { space } = useTheme();
  const put = useCache((s) => s.put);
  const status = d.registration?.status ?? 'DRAFT';
  const editable = d.semester.registrationOpen && (status === 'DRAFT' || status === 'REJECTED');
  const preset = d.registration?.offeringIds ?? (d.mode === 'REGULAR' ? d.available.filter((o) => o.isMain && !o.isElective).map((o) => o.id) : []);
  // Ticks are a draft on the phone: an expired session or a closed app loses nothing.
  const draft = useDraft(`registration.${d.semester.id}`, { ids: preset as string[], stage: d.mainStage ?? d.suggestedStage });
  const [submitted, setSubmitted] = useState(false);
  const { busy, error, run } = useSubmit();
  const selected = useMemo(() => new Set(draft.value.ids.filter((id) => d.available.some((o) => o.id === id))), [draft.value.ids, d.available]);
  const credits = d.available.filter((o) => selected.has(o.id)).reduce((t, o) => t + o.course.creditHours, 0);
  useEffect(() => { if (!editable && d.registration) draft.set('ids', d.registration.offeringIds); }, [editable, d.registration]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = (next: MyRegistration) => put(KEY, next);
  const chooseStage = (stage: number) => void run(async () => {
    const next = await registrationApi.mine(stage);
    apply(next);
    const keep = draft.value.ids.filter((id) => next.available.some((o) => o.id === id));
    draft.set('ids', [...new Set([...keep, ...next.available.filter((o) => o.isMain && !o.isElective).map((o) => o.id)])]);
    draft.set('stage', stage);
  });
  const toggle = (id: string) => draft.set('ids', selected.has(id) ? draft.value.ids.filter((x) => x !== id) : [...draft.value.ids, id]);
  const saveAndSubmit = () => void run(async () => {
    await registrationApi.save([...selected], d.mode === 'REGULAR' ? draft.value.stage : null);
    apply(await registrationApi.submit());
    draft.clear();
    setSubmitted(true);
  });
  const withdraw = () => void run(async () => apply(await registrationApi.withdraw()));

  if (submitted) return <SuccessState title="Registration submitted" reassurance={`Your ${selected.size} courses (${credits} credits) are saved and sent for approval.`} next="Your advisor or department reviews it. You will get a notification when it is approved or returned." action={{ label: 'See my registration', onPress: () => setSubmitted(false) }} />;
  if (d.mode === 'SUMMER_NOT_SET') return <EmptyState title="Summer registration has not opened" why="The academic office has not yet said whether this summer is promotional or upgrade." />;
  if (!d.available.length) return <EmptyState title="No courses to show" why="Your programme's curriculum has no courses for these semesters yet." />;

  const groups = [...new Set(d.available.map((o) => o.stage))].sort((a, b) => b - a);
  return (
    <View style={{ gap: space.lg }}>
      {d.registration ? <StatusCard reg={d.registration} /> : null}
      {!d.semester.registrationOpen ? <Notice tone="warning" title="Registration is closed">Course registration is not open for this term. Your courses below are read-only.</Notice> : null}
      {d.mode === 'UPGRADE' ? <Notice tone="info" title="Upgrade summer">You can retake any course up to your current level to improve the grade.</Notice> : null}
      {d.mode === 'REGULAR' ? <StagePicker total={d.totalStages} value={draft.value.stage} suggested={d.suggestedStage} disabled={!editable || busy} onChange={chooseStage} /> : null}
      <CreditBar credits={credits} min={d.semester.minCredits} max={d.semester.maxCredits} />
      <FormError error={error} />
      {groups.map((g) => (
        <View key={g} style={{ gap: space.sm }}>
          <Text variant="heading">{g === 0 ? 'Approved for you' : `Semester ${g}${g === draft.value.stage ? ' (main)' : ''}`}</Text>
          {d.available.filter((o) => o.stage === g).map((o) => {
            const missing = o.missingPrerequisites?.length ? `Needs ${o.missingPrerequisites.join(' and ')} taken first.` : null;
            const full = o.capacity !== null && o.seatsTaken >= o.capacity && !selected.has(o.id) ? 'This class is full.' : null;
            return <CourseOption key={o.id} o={o} checked={selected.has(o.id)} blocked={!editable ? 'Registration cannot be changed now.' : missing ?? full} onToggle={() => toggle(o.id)} />;
          })}
        </View>
      ))}
      <View style={{ gap: space.sm }}>
        {editable ? <Button label="Submit for approval" loading={busy} disabled={!selected.size || credits > d.semester.maxCredits || credits < d.semester.minCredits} onPress={saveAndSubmit} /> : null}
        {status === 'SUBMITTED' && d.semester.registrationOpen ? <Button label="Withdraw to make changes" variant="secondary" loading={busy} onPress={withdraw} /> : null}
        {status === 'SUBMITTED' || status === 'APPROVED' ? <Button label="Download registration slip (PDF)" variant="secondary" onPress={() => void run(() => openPdf('/me/registration/slip.pdf', `registration-${d.semester.label}.pdf`))} /> : null}
      </View>
    </View>
  );
}
