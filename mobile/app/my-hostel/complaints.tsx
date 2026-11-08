import { useState } from 'react';
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

interface Complaint { id: string; category: string; description: string; status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED'; officeNote: string | null; ownerResponse: string | null; createdAt: string; hostel: { name: string }; student: { firstName: string; lastName: string } | null }
const STATUS = { OPEN: ['New', 'warning'], IN_REVIEW: ['With the Hostel Office', 'primary'], RESOLVED: ['Resolved', 'success'], DISMISSED: ['Dismissed', 'neutral'] } as const;

export default function Complaints() {
  const q = useQuery<Complaint[]>('owner.complaints', '/hostel-complaints');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Complaints" subtitle="Students' complaints about your hostel, handled with the Hostel Office." />
      <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
        {(list) => list.length === 0 ? <EmptyState title="No complaints" why="Complaints students make about your hostel appear here so you can respond." /> : <>{list.map((c) => <ComplaintCard key={c.id} c={c} onDone={q.refresh} />)}</>}
      </QueryView>
    </Screen>
  );
}

function ComplaintCard({ c, onDone }: { c: Complaint; onDone: () => void }) {
  const [text, setText] = useState(c.ownerResponse ?? '');
  const [touched, setTouched] = useState(false);
  const { busy, error, run } = useSubmit();
  const problem = touched && text.trim().length < 5 ? 'Write a response of at least 5 characters.' : null;
  return (
    <Card>
      <Text variant="label">{c.hostel.name}: {c.category.toLowerCase().replace(/_/g, ' ')}</Text>
      <Badge label={STATUS[c.status][0]} tone={STATUS[c.status][1]} />
      <Text>{c.description}</Text>
      <Text variant="small" tone="muted">{c.student ? `${c.student.firstName} ${c.student.lastName}` : 'The student chose not to share their name'}, {new Date(c.createdAt).toLocaleDateString()}</Text>
      {c.officeNote ? <Text variant="small">Hostel Office: {c.officeNote}</Text> : null}
      <FormError error={error} />
      {c.status === 'OPEN' || c.status === 'IN_REVIEW' ? (
        <>
          <TextField label="Your response (the student and the Hostel Office see it)" value={text} onChangeText={setText} onBlur={() => setTouched(true)} multiline error={problem} />
          <Button label={c.ownerResponse ? 'Update response' : 'Respond'} loading={busy} onPress={() => { setTouched(true); if (text.trim().length >= 5) void run(async () => { await axiosInstance.post(`/hostel-complaints/${c.id}/respond`, { response: text.trim() }); onDone(); }); }} />
        </>
      ) : c.ownerResponse ? <Text variant="small">You replied: {c.ownerResponse}</Text> : null}
    </Card>
  );
}
