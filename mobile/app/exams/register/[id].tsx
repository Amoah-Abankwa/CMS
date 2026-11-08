import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
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
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';

type Status = 'PRESENT' | 'LATE' | 'ABSENT';
interface Register { id: string; registerClosedAt: string | null; offering: { course: { code: string; title: string } }; rows: Array<{ seatNumber: number; student: { id: string; firstName: string; lastName: string; indexNumber: string | null }; eligible: 'ELIGIBLE' | 'NOT_ELIGIBLE' | null; feeCleared: boolean; unpaidDues: string[]; attendance: { status: Status } | null }> }

export default function ExamRegister() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { space } = useTheme();
  const q = useQuery<Register>(`exam.register.${id}`, `/exams/register/${id}`);
  const [index, setIndex] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [closeNote, setCloseNote] = useState('');
  const { busy, error, run } = useSubmit();
  const mark = (body: { studentId?: string; indexNumber?: string; status: Status }) => void run(async () => {
    const r = (await axiosInstance.post<{ seatNumber: number; name: string; status: Status }>(`/exams/register/${id}/mark`, body)).data;
    setMsg(`Seat ${r.seatNumber}: ${r.name} marked ${r.status.toLowerCase()}.`); setIndex(''); q.refresh();
  });
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title={q.data ? `${q.data.offering.course.code} register` : 'Exam register'} subtitle={q.data?.offering.course.title} />
      <FormError error={error} />
      {msg ? <Notice tone="success">{msg}</Notice> : null}
      <QueryView q={q} skeleton={<SkeletonList rows={8} />}>
        {(r) => r.registerClosedAt ? <Notice tone="info" title="Register closed">The register for this paper is closed.</Notice> : (
          <View style={{ gap: space.md }}>
            <Card>
              <TextField label="Mark by index number" value={index} autoCapitalize="characters" onChangeText={setIndex} placeholder="ANU25400001" error={index && !/^[A-Za-z]{2,6}\d{6,9}$/.test(index.trim()) ? 'An index number looks like ANU25400001.' : null} />
              <Button label="Present" disabled={!/^[A-Za-z]{2,6}\d{6,9}$/.test(index.trim())} loading={busy} onPress={() => mark({ indexNumber: index.trim().toUpperCase(), status: 'PRESENT' })} />
            </Card>
            {r.rows.map((row) => (
              <Card key={row.student.id} style={{ padding: 10 }}>
                <Text variant="label">Seat {row.seatNumber}: {row.student.firstName} {row.student.lastName}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                  {row.eligible === 'NOT_ELIGIBLE' ? <Badge label="Not eligible" tone="danger" /> : null}
                  {!row.feeCleared ? <Badge label="Fees not cleared" tone="warning" /> : null}
                  {row.unpaidDues.length ? <Badge label={`Dues: ${row.unpaidDues.join(', ')}`} tone="warning" /> : null}
                </View>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  {(['PRESENT', 'LATE', 'ABSENT'] as Status[]).map((s) => <Chip key={s} label={s === 'PRESENT' ? 'Present' : s === 'LATE' ? 'Late' : 'Absent'} selected={row.attendance?.status === s} onPress={() => mark({ studentId: row.student.id, status: s })} />)}
                </View>
              </Card>
            ))}
            <Card>
              <TextField label="Note on the paper (optional)" value={closeNote} onChangeText={setCloseNote} placeholder="Started 10 minutes late because of a power cut" />
              <Button label="Close the register" variant="danger" loading={busy} onPress={() => void run(async () => { const x = (await axiosInstance.post<{ absent: number }>(`/exams/register/${id}/close`, { note: closeNote.trim() || undefined })).data; setMsg(`Register closed. ${x.absent} recorded absent.`); q.refresh(); })} />
            </Card>
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
