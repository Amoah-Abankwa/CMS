import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { feesApi } from '@/api/fees';
import { FormError } from '@/components/states/FormError';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

type Row = { dueDate: string; percent: string };

/** Paying in instalments: each due date and the share of the bill paid by then (rising to 100%). */
export function Instalments({ semesterId }: { semesterId: string }) {
  const { space } = useTheme();
  const q = useQuery<{ instalments: Array<{ dueDate: string; cumulativePercent: number }> }>(`fees.instalments.${semesterId}`, `/fees/instalments/${semesterId}`);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useSubmit();
  useEffect(() => { if (q.data && rows === null) setRows(q.data.instalments.map((i) => ({ dueDate: i.dueDate.slice(0, 10), percent: String(i.cumulativePercent) }))); }, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows) return null;
  const problem = (r: Row, i: number) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.dueDate)) return 'Due date as YYYY-MM-DD.';
    const p = Number(r.percent);
    if (!(p > 0 && p <= 100)) return 'A share from 1 to 100%.';
    if (i > 0 && (r.dueDate <= rows[i - 1].dueDate || p <= Number(rows[i - 1].percent))) return 'Later and larger than the one before.';
    return null;
  };
  const last = rows[rows.length - 1];
  const endsWrong = rows.length > 0 && Number(last.percent) !== 100 ? 'The last instalment must bring it to 100%.' : null;
  if (saved) return <SuccessState title="Instalments saved" reassurance="Students see the next amount due on their fees page." next="Late charges, if on, apply after each due date." action={{ label: 'Done', onPress: () => setSaved(false) }} />;
  return (
    <Card>
      <Text variant="heading">Instalments</Text>
      <Text variant="small" tone="muted">Leave empty for one payment. Each line is the total share paid by that date.</Text>
      <FormError error={error} />
      {rows.map((r, i) => (
        <View key={i} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 2 }}><TextField label={`Instalment ${i + 1} due`} value={r.dueDate} placeholder="YYYY-MM-DD" onChangeText={(x) => setRows(rows.map((y, n) => (n === i ? { ...y, dueDate: x } : y)))} /></View>
            <View style={{ flex: 1 }}><TextField label="Paid by then (%)" value={r.percent} keyboardType="number-pad" onChangeText={(x) => setRows(rows.map((y, n) => (n === i ? { ...y, percent: x } : y)))} /></View>
          </View>
          {problem(r, i) ? <Text variant="small" tone="danger">{problem(r, i)}</Text> : null}
          <Button label="Remove" variant="ghost" onPress={() => setRows(rows.filter((_, n) => n !== i))} />
        </View>
      ))}
      {endsWrong ? <Text variant="small" tone="danger">{endsWrong}</Text> : null}
      <Button label="Add an instalment" variant="secondary" onPress={() => setRows([...rows, { dueDate: '', percent: rows.length ? '100' : '50' }])} />
      <Button label="Save instalments" disabled={rows.some((r, i) => problem(r, i)) || !!endsWrong} loading={busy} onPress={() => void run(async () => { await feesApi.saveInstalments(semesterId, rows.map((r) => ({ dueDate: r.dueDate, cumulativePercent: Number(r.percent) }))); setSaved(true); })} />
    </Card>
  );
}
