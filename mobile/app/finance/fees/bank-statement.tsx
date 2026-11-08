import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { formatMoney, parseCsv } from '@anu/shared';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';

type Key = 'date' | 'amount' | 'reference' | 'narration';
type Line = { line: number; date: string; amount: number; reference: string; narration: string; bill: { id: string; student: { indexNumber: string; firstName: string; lastName: string } } | null; problem: string | null };
const LABEL: Record<Key, string> = { date: 'Date', amount: 'Amount (credit)', reference: 'Reference', narration: 'Narration' };
const guess = (h: string[], words: string[]) => h.findIndex((x) => words.some((w) => x.toLowerCase().includes(w)));
const toDate = (v: string) => { const t = v.trim(); if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10); const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(t); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };

/** Bank deposits matched to bills by the index number in the narration; Finance chooses which to record. */
export default function BankStatement() {
  const { space, colors } = useTheme();
  const [currency, setCurrency] = useState<'GHS' | 'USD'>('GHS');
  const [cols, setCols] = useState<{ name: string; headers: string[]; rows: string[][] } | null>(null);
  const [map, setMap] = useState<Record<Key, number>>({ date: -1, amount: -1, reference: -1, narration: -1 });
  const [lines, setLines] = useState<Line[] | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [done, setDone] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const pick = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel'], copyToCacheDirectory: true });
    if (r.canceled || !r.assets[0]) return;
    const rows = parseCsv(await new File(r.assets[0].uri).text());
    if (rows.length < 2) { setNote('The file has no rows under its headings.'); return; }
    setNote(null); setLines(null);
    setCols({ name: r.assets[0].name, headers: rows[0], rows: rows.slice(1) });
    setMap({ date: guess(rows[0], ['date']), amount: guess(rows[0], ['credit', 'amount', 'deposit']), reference: guess(rows[0], ['ref', 'transaction', 'id']), narration: guess(rows[0], ['narration', 'description', 'details', 'remark']) });
  };
  const missing = (Object.keys(map) as Key[]).filter((k) => map[k] < 0);
  const match = () => void run(async () => {
    if (!cols) return;
    const rows = cols.rows.map((r) => ({ date: toDate(r[map.date] ?? ''), amount: Math.round(Number(String(r[map.amount] ?? '').replace(/[^0-9.]/g, '')) * 100), reference: (r[map.reference] ?? '').trim(), narration: (r[map.narration] ?? '').trim() })).filter((r) => r.date && r.amount > 0 && r.reference);
    const out = (await axiosInstance.post<Line[]>('/fees/bank-statement/match', { currency, rows })).data;
    setLines(out); setChosen(new Set(out.filter((l) => l.bill).map((l) => l.line)));
    setNote(rows.length < cols.rows.length ? `${cols.rows.length - rows.length} lines were skipped (no amount, date or reference, or a withdrawal).` : null);
  });
  const apply = () => void run(async () => {
    const items = (lines ?? []).filter((l) => l.bill && chosen.has(l.line)).map((l) => ({ billId: l.bill!.id, amount: l.amount, reference: l.reference, paidOn: l.date }));
    const out = (await axiosInstance.post<Array<{ reference: string; ok: boolean; message?: string }>>('/fees/bank-statement/apply', { currency, items })).data;
    const bad = out.filter((o) => !o.ok);
    setDone(`${out.length - bad.length} payments recorded.${bad.length ? ` Not recorded: ${bad.map((b) => `${b.reference} (${b.message})`).join('; ')}.` : ''}`);
  });
  if (done) return <Screen><SuccessState title="Statement recorded" reassurance={done} next="Students get receipts; references can never be recorded twice." action={{ label: 'Another statement', onPress: () => { setDone(null); setLines(null); setCols(null); } }} /></Screen>;
  return (
    <Screen>
      <Header title="Bank statement" subtitle="Record school-fee deposits from the bank's statement (CSV)." />
      <View style={{ flexDirection: 'row', gap: space.sm }}><Chip label="Cedi account" selected={currency === 'GHS'} onPress={() => setCurrency('GHS')} /><Chip label="Dollar account" selected={currency === 'USD'} onPress={() => setCurrency('USD')} /></View>
      <FormError error={error} />
      {note ? <Notice tone="warning">{note}</Notice> : null}
      <Button label={cols ? `Change file (${cols.name})` : 'Choose the statement (CSV)'} variant="secondary" onPress={() => void pick()} />
      {cols ? (
        <Card>
          {(Object.keys(LABEL) as Key[]).map((k) => (
            <View key={k} style={{ gap: 4 }}>
              <Text variant="small" tone={map[k] < 0 ? 'danger' : 'default'}>{LABEL[k]}: {map[k] >= 0 ? cols.headers[map[k]] : 'choose its column'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>{cols.headers.map((h, i) => <Chip key={`${h}${i}`} label={h || `Column ${i + 1}`} selected={map[k] === i} onPress={() => setMap({ ...map, [k]: i })} />)}</ScrollView>
            </View>
          ))}
          <Button label="Match deposits to bills" disabled={missing.length > 0} loading={busy} onPress={match} />
        </Card>
      ) : null}
      {lines ? (
        <>
          <Text variant="heading">{lines.filter((l) => l.bill).length} of {lines.length} deposits matched</Text>
          {lines.map((l) => (
            <Pressable key={l.line} accessibilityRole="checkbox" accessibilityState={{ checked: chosen.has(l.line), disabled: !l.bill }} disabled={!l.bill} onPress={() => setChosen((p) => { const n = new Set(p); if (n.has(l.line)) n.delete(l.line); else n.add(l.line); return n; })}>
              <Card style={{ padding: 10, flexDirection: 'row', gap: space.sm }}>
                <Ionicons name={chosen.has(l.line) ? 'checkbox' : 'square-outline'} size={22} color={l.bill ? colors.primary : colors.border} />
                <View style={{ flex: 1 }}>
                  <Text variant="label">{formatMoney(l.amount, currency)} on {l.date}, ref {l.reference}</Text>
                  <Text variant="small" tone={l.bill ? 'muted' : 'danger'}>{l.bill ? `${l.bill.student.firstName} ${l.bill.student.lastName}, ${l.bill.student.indexNumber}` : l.problem ?? 'No student found in the narration.'}</Text>
                </View>
              </Card>
            </Pressable>
          ))}
          <Button label={`Record ${chosen.size} payments`} disabled={!chosen.size} loading={busy} onPress={apply} />
        </>
      ) : null}
    </Screen>
  );
}
