import { useState } from 'react';
import { View } from 'react-native';
import { formatCedis, timesheetAmount } from '@anu/shared';
import { FormError } from '@/components/states/FormError';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useDraft } from '@/hooks/useDraft';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';
import type { Hire, Sheet } from './types';

type Row = { date: string; quantity: string; note: string };
const rowProblem = (r: Row, hourly: boolean) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return 'Write the date as YYYY-MM-DD, e.g. 2026-11-03.';
  const n = Number(r.quantity);
  if (!(n > 0)) return hourly ? 'Enter the hours worked, e.g. 2.5.' : 'Enter how many tasks, e.g. 1.';
  if (hourly && (n > 12 || Math.round(n * 4) !== n * 4)) return 'Hours go in quarter hours (0.25, 0.5, 0.75) and at most 12 a day.';
  return null;
};

/** One month's timesheet: add days, see the amount, send for approval. Kept as a draft until sent. */
export function TimesheetEditor({ hire, sheet, onDone }: { hire: Hire; sheet: Sheet; onDone: () => void }) {
  const { space } = useTheme();
  const hourly = hire.job.payUnit === 'HOUR';
  const draft = useDraft<{ rows: Row[] }>(`work.sheet.${sheet.id}`, { rows: sheet.entries.length ? sheet.entries.map((e) => ({ date: e.date.slice(0, 10), quantity: String(e.quantity), note: e.note ?? '' })) : [{ date: `${sheet.period}-01`, quantity: '', note: '' }] });
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useSubmit();
  const rows = draft.value.rows;
  const setRow = (i: number, r: Partial<Row>) => draft.set('rows', rows.map((x, n) => (n === i ? { ...x, ...r } : x)));
  const amount = timesheetAmount(hire.job.payUnit, hire.job.payRate, rows.filter((r) => Number(r.quantity) > 0).map((r) => ({ quantity: Number(r.quantity) })));
  if (sent) return <SuccessState title="Timesheet sent" reassurance={`${sheet.period}: ${formatCedis(amount)} went to your supervisor.`} next="They approve it, then Finance pays it to your mobile money number." action={{ label: 'Done', onPress: onDone }} />;
  const send = (submit: boolean) => {
    setTouched(true);
    if (rows.some((r) => rowProblem(r, hourly))) return;
    void run(async () => {
      await axiosInstance.put(`/me/timesheets/${sheet.id}`, { entries: rows.map((r) => ({ date: r.date, quantity: Number(r.quantity), note: r.note.trim() || undefined })) });
      if (submit) await axiosInstance.post(`/me/timesheets/${sheet.id}/submit`);
      draft.clear();
      submit ? setSent(true) : onDone();
    });
  };
  return (
    <Card>
      <Text variant="heading">{hire.job.title}, {sheet.period}</Text>
      {sheet.returnNote ? <Text tone="warning">Returned: {sheet.returnNote}</Text> : null}
      <FormError error={error} />
      {rows.map((r, i) => (
        <View key={i} style={{ gap: space.xs }}>
          <TextField label={`Day ${i + 1}`} value={r.date} onChangeText={(v) => setRow(i, { date: v })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
          <TextField label={hourly ? 'Hours' : 'Tasks'} value={r.quantity} onChangeText={(v) => setRow(i, { quantity: v.replace(',', '.') })} keyboardType="decimal-pad" error={touched ? rowProblem(r, hourly) : null} />
        </View>
      ))}
      <Button label="Add a day" variant="ghost" onPress={() => draft.set('rows', [...rows, { date: '', quantity: '', note: '' }])} />
      <Text variant="label">Amount: {formatCedis(amount)}</Text>
      <Button label="Send for approval" loading={busy} onPress={() => send(true)} />
      <Button label="Save for later" variant="secondary" loading={busy} onPress={() => send(false)} />
    </Card>
  );
}
