import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { formatMoney } from '@anu/shared';
import { feesApi, type Bill } from '@/api/fees';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { QueryView } from '@/components/states/QueryView';
import { StepUpPrompt } from '@/components/states/StepUpPrompt';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useStepUp } from '@/hooks/useStepUp';
import { useSubmit } from '@/hooks/useSubmit';
import { openPdf } from '@/lib/files';
import { useCache } from '@/stores/cache';
import { useTheme } from '@/theme/useTheme';

type Method = 'BANK' | 'MOBILE_MONEY' | 'CHEQUE';

export default function BillScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const key = `fees.bill.${id}`;
  const q = useQuery<Bill>(key, `/fees/bills/${id}`);
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title={q.data ? `${q.data.student.firstName} ${q.data.student.lastName}` : 'Bill'} subtitle={q.data ? `${q.data.student.indexNumber}, ${q.data.semester.academicYear.label}` : undefined} />
      <QueryView q={q} skeleton={<SkeletonCard lines={8} />}>{(b) => <BillView b={b} cacheKey={key} />}</QueryView>
    </Screen>
  );
}

function BillView({ b, cacheKey }: { b: Bill; cacheKey: string }) {
  const { space } = useTheme();
  const put = useCache((s) => s.put);
  // The server sends a bill's figures worked out: due, balance (negative when overpaid), percentage paid.
  const paid = b.due - b.balance;
  const [mode, setMode] = useState<null | 'pay' | 'adjust'>(null);
  const [reversing, setReversing] = useState<{ id: string; reason: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const step = useStepUp();
  const { busy, error, run } = useSubmit();
  const m = (n: number) => formatMoney(n, b.currency);
  return (
    <View style={{ gap: space.md }}>
      <FormError error={error} />
      {msg ? <Notice tone="success">{msg}</Notice> : null}
      {step.asking ? <StepUpPrompt onConfirm={step.confirm} onCancel={step.cancel} /> : null}
      <Card>
        <Text variant="title">{b.balance > 0 ? `${m(b.balance)} owed` : 'Paid in full'}</Text>
        <Text variant="small" tone="muted">Due {m(b.due)}, paid {m(paid)} ({b.percentPaid}%).{b.overpaid ? ` Overpaid by ${m(b.overpaid)}.` : ''}</Text>
        {b.clearance?.cleared ? <Badge label="Cleared for exams" tone="success" /> : null}
        {b.lines.map((l) => <Text key={l.name} variant="small">{l.name}: {m(l.amount)}</Text>)}
        {b.adjustments.map((a) => <Text key={a.id} variant="small">{a.amount < 0 ? 'Less' : 'Plus'} {m(Math.abs(a.amount))}: {a.reason}</Text>)}
        <Button label="Statement (PDF)" variant="ghost" onPress={() => void run(() => openPdf(`/fees/bills/${b.id}/statement/pdf`, `statement-${b.student.indexNumber}.pdf`))} />
      </Card>
      <Text variant="heading">Payments</Text>
      {b.payments.length === 0 ? <Text tone="muted">No payments yet.</Text> : b.payments.map((p) => (
        <Card key={p.id} style={{ padding: 10 }}>
          <Text variant="label">{m(p.amount)} by {p.method.toLowerCase().replace('_', ' ')}, {p.paidOn.slice(0, 10)}</Text>
          <Text variant="small" tone="muted">Receipt {p.receiptNumber}, reference {p.reference}</Text>
          {p.reversedAt ? <Badge label={`Reversed: ${p.reversalReason ?? ''}`} tone="danger" /> : (
            <>
              <Button label="Receipt (PDF)" variant="ghost" onPress={() => void run(() => openPdf(`/fees/payments/${p.id}/receipt/pdf`, `receipt-${p.receiptNumber}.pdf`))} />
              {reversing?.id === p.id ? (
                <>
                  <TextField label="Why it is reversed (recorded)" value={reversing.reason} onChangeText={(x) => setReversing({ ...reversing, reason: x })} error={reversing.reason && reversing.reason.trim().length < 5 ? 'At least 5 characters.' : null} />
                  <Button label="Reverse the payment" variant="danger" disabled={reversing.reason.trim().length < 5} loading={busy} onPress={() => void run(() => step.guard(async () => { put(cacheKey, await feesApi.reverse(p.id, reversing.reason.trim())); setReversing(null); setMsg('Payment reversed.'); }))} />
                </>
              ) : p.method !== 'ONLINE' ? <Button label="Reverse" variant="ghost" onPress={() => setReversing({ id: p.id, reason: '' })} /> : null}
            </>
          )}
        </Card>
      ))}
      {mode === 'pay' ? <RecordPayment b={b} onDone={(next) => { if (next) { put(cacheKey, next); setMsg('Payment recorded; the student gets a receipt.'); } setMode(null); }} /> : mode === 'adjust' ? <Adjust b={b} onDone={(next) => { if (next) { put(cacheKey, next); setMsg('Adjustment saved.'); } setMode(null); }} /> : (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}><Button label="Record a payment" onPress={() => setMode('pay')} /></View>
          <View style={{ flex: 1 }}><Button label="Adjust" variant="secondary" onPress={() => setMode('adjust')} /></View>
        </View>
      )}
    </View>
  );
}

function RecordPayment({ b, onDone }: { b: Bill; onDone: (b: Bill | null) => void }) {
  const { space } = useTheme();
  const [f, setF] = useState({ amount: '', method: 'BANK' as Method, reference: '', paidOn: new Date().toISOString().slice(0, 10) });
  const { busy, error, run } = useSubmit();
  const errs = { amount: Number(f.amount) > 0 ? null : `Amount in ${b.currency === 'USD' ? 'dollars' : 'cedis'}.`, reference: f.reference.trim().length >= 3 ? null : 'The bank, MoMo or cheque reference.', paidOn: /^\d{4}-\d{2}-\d{2}$/.test(f.paidOn) && f.paidOn <= new Date().toISOString().slice(0, 10) ? null : 'A date up to today, as YYYY-MM-DD.' };
  return (
    <Card>
      <Text variant="heading">Record a payment</Text>
      <FormError error={error} />
      <TextField label={`Amount (${b.currency === 'USD' ? 'US$' : 'GH₵'})`} value={f.amount} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, amount: x.replace(',', '.') })} error={f.amount ? errs.amount : null} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>{(['BANK', 'MOBILE_MONEY', 'CHEQUE'] as Method[]).map((x) => <Chip key={x} label={x === 'BANK' ? 'Bank' : x === 'MOBILE_MONEY' ? 'MoMo' : 'Cheque'} selected={f.method === x} onPress={() => setF({ ...f, method: x })} />)}</View>
      <TextField label="Reference" value={f.reference} onChangeText={(x) => setF({ ...f, reference: x })} error={f.reference ? errs.reference : null} />
      <TextField label="Paid on" value={f.paidOn} onChangeText={(x) => setF({ ...f, paidOn: x })} error={errs.paidOn} />
      <Button label="Record" disabled={Object.values(errs).some(Boolean)} loading={busy} onPress={() => void run(async () => onDone(await feesApi.recordPayment(b.id, { amount: Math.round(Number(f.amount) * 100), method: f.method, reference: f.reference.trim(), paidOn: f.paidOn })))} />
      <Button label="Cancel" variant="ghost" onPress={() => onDone(null)} />
    </Card>
  );
}

function Adjust({ b, onDone }: { b: Bill; onDone: (b: Bill | null) => void }) {
  const { space } = useTheme();
  const [f, setF] = useState({ amount: '', reduce: true, reason: '' });
  const { busy, error, run } = useSubmit();
  const errs = { amount: Number(f.amount) > 0 ? null : 'The amount.', reason: f.reason.trim().length >= 5 ? null : 'What it is for, e.g. "Vice-Chancellor scholarship (25% of tuition)".' };
  return (
    <Card>
      <Text variant="heading">Adjust the bill</Text>
      <FormError error={error} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label="Reduce (scholarship, waiver)" selected={f.reduce} onPress={() => setF({ ...f, reduce: true })} />
        <Chip label="Add a charge" selected={!f.reduce} onPress={() => setF({ ...f, reduce: false })} />
      </View>
      <TextField label="Amount" value={f.amount} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, amount: x.replace(',', '.') })} error={f.amount ? errs.amount : null} />
      <TextField label="Reason (shown on the statement)" value={f.reason} onChangeText={(x) => setF({ ...f, reason: x })} error={f.reason ? errs.reason : null} />
      <Button label="Save" disabled={Object.values(errs).some(Boolean)} loading={busy} onPress={() => void run(async () => onDone(await feesApi.adjust(b.id, { amount: (f.reduce ? -1 : 1) * Math.round(Number(f.amount) * 100), reason: f.reason.trim() })))} />
      <Button label="Cancel" variant="ghost" onPress={() => onDone(null)} />
    </Card>
  );
}
