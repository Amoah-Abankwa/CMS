import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { APPLICATION_STATUS_LABEL } from '@anu/shared';
import type { JobDetail } from '@/api/employment';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';

export default function Applicants() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { space } = useTheme();
  const q = useQuery<JobDetail>(`opps.job.${id}`, `/opportunities/jobs/${id}`);
  const [note, setNote] = useState('');
  const { busy, error, run } = useSubmit();
  const decide = (applicationId: string, status: 'SHORTLISTED' | 'HIRED' | 'REJECTED') => void run(async () => {
    await axiosInstance.post(`/opportunities/applications/${applicationId}/decision`, { status, note: note.trim() || undefined, startDate: status === 'HIRED' ? new Date().toISOString().slice(0, 10) : undefined });
    setNote(''); q.refresh();
  });
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title={q.data?.title ?? 'Applicants'} subtitle="Shortlist, hire or turn down. Applicants are told each decision." />
      <FormError error={error} />
      <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
        {(j) => j.applications.length === 0 ? <EmptyState title="No applicants yet" why="Students who apply appear here. Applications close on the date you set." /> : <>
          <TextField label="Note to send with your next decision (optional)" value={note} onChangeText={setNote} />
          {j.applications.map((a) => (
            <Card key={a.id}>
              <Text variant="heading">{a.student.firstName} {a.student.lastName}</Text>
              <Text variant="small" tone="muted">{a.student.indexNumber}{a.cgpa != null ? `, CGPA ${a.cgpa.toFixed(2)}` : ''}</Text>
              <Badge label={APPLICATION_STATUS_LABEL[a.status]} tone={a.status === 'HIRED' ? 'success' : a.status === 'REJECTED' ? 'danger' : 'primary'} />
              <Text>{a.statement}</Text>
              {a.availability ? <Text variant="small" tone="muted">Free: {a.availability}</Text> : null}
              {!a.eligibility.eligible ? <Text variant="small" tone="warning">{a.eligibility.reasons.join(' ')}</Text> : null}
              {a.status === 'SUBMITTED' || a.status === 'SHORTLISTED' ? (
                <View style={{ gap: space.sm }}>
                  {a.status === 'SUBMITTED' ? <Button label="Shortlist" variant="secondary" loading={busy} onPress={() => decide(a.id, 'SHORTLISTED')} /> : null}
                  <Button label="Hire" disabled={!a.eligibility.eligible} loading={busy} onPress={() => decide(a.id, 'HIRED')} />
                  <Button label="Turn down" variant="ghost" loading={busy} onPress={() => decide(a.id, 'REJECTED')} />
                </View>
              ) : null}
            </Card>
          ))}
        </>}
      </QueryView>
    </Screen>
  );
}
