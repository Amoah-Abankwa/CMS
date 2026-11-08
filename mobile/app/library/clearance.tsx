import { useState } from 'react';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';

interface Result { rows: Array<{ student: { id: string; firstName: string; lastName: string; indexNumber: string }; clear: boolean; reasons: string[]; certificate: { certificateNumber: string } | null }>; notFound: string[] }

export default function LibraryClearance() {
  const [text, setText] = useState('');
  const [data, setData] = useState<Result | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const list = text.split(/[\s,;]+/).filter(Boolean);
  const bad = list.filter((i) => !/^[A-Za-z]{2,6}\d{6,9}$/.test(i));
  const check = () => run(async () => setData((await axiosInstance.post<Result>('/library/clearance/check', { indexNumbers: text })).data));
  return (
    <Screen>
      <Header title="Library clearance" subtitle="For graduation or leaving: nothing out and nothing owed." />
      <Card>
        <TextField label="Index numbers" value={text} multiline onChangeText={setText} placeholder="One or many: ANU22400001, ANU22400002" error={bad.length ? `Check: ${bad.slice(0, 3).join(', ')}.` : null} />
        <Button label="Check" disabled={!list.length || bad.length > 0} loading={busy} onPress={() => void check()} />
      </Card>
      <FormError error={error} />
      {msg ? <Notice tone="success">{msg}</Notice> : null}
      {data?.notFound.length ? <Notice tone="warning">Not found: {data.notFound.join(', ')}.</Notice> : null}
      {data?.rows.map((r) => (
        <Card key={r.student.id} style={{ padding: 10 }}>
          <Text variant="label">{r.student.firstName} {r.student.lastName} <Text variant="small" tone="muted">{r.student.indexNumber}</Text></Text>
          {r.certificate ? <Badge label={`Certificate ${r.certificate.certificateNumber}`} tone="success" /> : r.clear ? (
            <Button label="Issue certificate" variant="secondary" loading={busy} onPress={() => void run(async () => { await axiosInstance.post('/library/clearance/issue', { indexNumber: r.student.indexNumber }); setMsg(`Certificate issued for ${r.student.indexNumber}.`); await check(); })} />
          ) : <Text variant="small" tone="danger">{r.reasons.join(' ')}</Text>}
        </Card>
      ))}
    </Screen>
  );
}
