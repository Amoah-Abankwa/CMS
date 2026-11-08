import { useState } from 'react';
import { Linking, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { APPLICATION_STATUS_LABEL, formatCedis, PAY_UNIT_LABEL } from '@anu/shared';
import { workApi, type StudentJob } from '@/api/employment';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useDraft } from '@/hooks/useDraft';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

export default function Job() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery<StudentJob>(`work.job.${id}`, `/me/work/jobs/${id}`);
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title={q.data?.title ?? 'Job'} subtitle={q.data ? q.data.organisation ?? q.data.unit : undefined} />
      <QueryView q={q} skeleton={<SkeletonCard lines={6} />}>{(j) => <JobView j={j} refresh={q.refresh} />}</QueryView>
    </Screen>
  );
}

function JobView({ j, refresh }: { j: StudentJob; refresh: () => void }) {
  const { space } = useTheme();
  const draft = useDraft(`work.apply.${j.id}`, { statement: '', availability: '' });
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useSubmit();
  const short = touched && draft.value.statement.trim().length < 30 ? `Say why you are a good fit in at least 30 characters (${draft.value.statement.trim().length} so far).` : null;
  return (
    <View style={{ gap: space.md }}>
      <Card>
        <Text>{formatCedis(j.payRate)} {PAY_UNIT_LABEL[j.payUnit]}, about {j.hoursPerWeek} hours a week, {j.positions} place{j.positions === 1 ? '' : 's'}.</Text>
        {j.supervisor ? <Text variant="small" tone="muted">Supervisor: {j.supervisor.firstName} {j.supervisor.lastName}</Text> : null}
        <Text>{j.description}</Text>
      </Card>
      {j.applyUrl ? <Button label="Apply on the employer's site" onPress={() => void Linking.openURL(j.applyUrl!)} /> : j.myApplication ? (
        <Notice tone="info" title={APPLICATION_STATUS_LABEL[j.myApplication.status]}>{j.myApplication.decisionNote ?? 'We will notify you when there is news.'}</Notice>
      ) : !j.eligibility.eligible ? (
        <Notice tone="warning" title="You cannot apply for this job">{j.eligibility.reasons.join(' ')}</Notice>
      ) : sent ? (
        <SuccessState title="Application sent" reassurance="Your statement and availability went to the supervisor." next="You will get a notification if you are shortlisted or hired." action={{ label: 'Done', onPress: refresh }} />
      ) : (
        <Card>
          <Text variant="heading">Apply</Text>
          <FormError error={error} />
          <TextField label="Why you are a good fit" value={draft.value.statement} onChangeText={(v) => draft.set('statement', v)} onBlur={() => setTouched(true)} multiline style={{ minHeight: 120, textAlignVertical: 'top', paddingTop: 12 }} error={short ?? error?.fields.statement} />
          <TextField label="When you are free (optional)" value={draft.value.availability} onChangeText={(v) => draft.set('availability', v)} placeholder="Weekday evenings, Saturdays" />
          <Button label="Send application" loading={busy} onPress={() => {
            setTouched(true);
            if (draft.value.statement.trim().length < 30) return;
            void run(async () => { await workApi.apply(j.id, { statement: draft.value.statement.trim(), availability: draft.value.availability.trim() || undefined }); draft.clear(); setSent(true); });
          }} />
        </Card>
      )}
    </View>
  );
}
