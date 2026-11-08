import { useState } from 'react';
import { View } from 'react-native';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { DecisionCard } from '@/features/approvals/DecisionCard';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';
import { openFile } from '@/lib/files';
import { useTheme } from '@/theme/useTheme';

interface Req { id: string; fromDate: string; toDate: string; category: string; statement: string; status: string; createdAt: string; document: { id: string; originalName: string } | null; student: { firstName: string; lastName: string; indexNumber: string | null } }

export default function ExcuseRequests() {
  const { space } = useTheme();
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const q = useQuery<Req[]>(`excuse.requests.${status}`, '/attendance/excuse-requests', { status });
  const doc = useSubmit();
  const decide = async (id: string, approve: boolean, note?: string) => { await axiosInstance.post(`/attendance/excuse-requests/${id}/decide`, { approve, note }); q.refresh(); };
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Excuse requests" subtitle="Students asking to be excused, with their documents." />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label="Waiting" selected={status === 'PENDING'} onPress={() => setStatus('PENDING')} />
        <Chip label="Approved" selected={status === 'APPROVED'} onPress={() => setStatus('APPROVED')} />
        <Chip label="Rejected" selected={status === 'REJECTED'} onPress={() => setStatus('REJECTED')} />
      </View>
      <FormError error={doc.error} />
      <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
        {(list) => list.length === 0 ? <EmptyState title="Nothing here" why={status === 'PENDING' ? 'No student is waiting for a decision.' : 'No requests with this decision yet.'} /> : <>{list.map((r) => {
          const body = (
            <>
              <Text variant="heading">{r.student.firstName} {r.student.lastName}</Text>
              <Text variant="small" tone="muted">{r.student.indexNumber}. {r.category.toLowerCase().replace('_', ' ')}: {r.fromDate.slice(0, 10)} to {r.toDate.slice(0, 10)}</Text>
              <Text>{r.statement}</Text>
              {r.document ? <Button label={`Open ${r.document.originalName}`} variant="secondary" loading={doc.busy} onPress={() => void doc.run(() => openFile(`/documents/${r.document!.id}/download`, r.document!.originalName))} /> : <Text variant="small" tone="muted">No document attached.</Text>}
            </>
          );
          return status === 'PENDING'
            ? <DecisionCard key={r.id} rejectLabel="Reject" onApprove={() => decide(r.id, true)} onReject={(note) => decide(r.id, false, note)}>{body}</DecisionCard>
            : <View key={r.id} style={{ gap: 4 }}>{body}</View>;
        })}</>}
      </QueryView>
    </Screen>
  );
}
