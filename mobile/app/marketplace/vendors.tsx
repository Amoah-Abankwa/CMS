import { useState } from 'react';
import { View } from 'react-native';
import { foodApi, type AdminVendor } from '@/api/marketplace';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { DecisionCard } from '@/features/approvals/DecisionCard';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { validate } from '@/lib/validate';

const STATUS = { PENDING: ['Waiting for approval', 'warning'], APPROVED: ['Approved', 'success'], SUSPENDED: ['Suspended', 'danger'], REJECTED: ['Rejected', 'neutral'] } as const;

export default function Vendors() {
  const q = useQuery<AdminVendor[]>('mkt.vendors', '/marketplace/vendors');
  const settings = useQuery<{ commissionPercent: number; unpaidMinutes: number }>('mkt.settings', '/marketplace/settings');
  const [adding, setAdding] = useState(false);
  const review = async (id: string, status: 'APPROVED' | 'SUSPENDED' | 'REJECTED', note?: string) => { await foodApi.review(id, status, note); q.refresh(); };
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Vendors" subtitle="Campus food vendors. Approve them before students can order." />
      {adding ? <AddVendor onDone={() => { setAdding(false); q.refresh(); }} /> : <Button label="Add a vendor" onPress={() => setAdding(true)} />}
      <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
        {(list) => list.length === 0 ? <EmptyState title="No vendors yet" why="Add each vendor with their owner's contact; they get an email to set up their account." /> : <>{list.map((v) => {
          const body = (
            <>
              <Text variant="heading">{v.name}</Text>
              <Text variant="small" tone="muted">{v.location}. {v.owner.firstName} {v.owner.lastName}, {v.owner.phone ?? v.phone}. {v.menuItems} dishes, {v.ordersLast30Days} orders in 30 days.</Text>
              <Badge label={STATUS[v.status][0]} tone={STATUS[v.status][1]} />
              {v.statusNote ? <Text variant="small">{v.statusNote}</Text> : null}
            </>
          );
          if (v.status === 'PENDING') return <DecisionCard key={v.id} rejectLabel="Reject" onApprove={() => review(v.id, 'APPROVED')} onReject={(note) => review(v.id, 'REJECTED', note)}>{body}</DecisionCard>;
          if (v.status === 'APPROVED') return <DecisionCard key={v.id} approveLabel="Re-approve" rejectLabel="Suspend" onApprove={() => review(v.id, 'APPROVED')} onReject={(note) => review(v.id, 'SUSPENDED', note)}>{body}</DecisionCard>;
          return <Card key={v.id}>{body}<Button label="Approve" variant="secondary" onPress={() => void review(v.id, 'APPROVED')} /></Card>;
        })}</>}
      </QueryView>
      <QueryView q={settings} skeleton={null}>{(s) => <Settings s={s} onSaved={settings.refresh} />}</QueryView>
    </Screen>
  );
}

function AddVendor({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ vendorName: '', location: '', firstName: '', lastName: '', email: '', phone: '' });
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState(false);
  const { busy, error, run } = useSubmit();
  const errs = { vendorName: f.vendorName.trim().length >= 3 ? null : 'The shop name.', location: f.location.trim().length >= 3 ? null : 'Where on campus.', firstName: f.firstName.trim() ? null : "The owner's first name.", lastName: f.lastName.trim() ? null : "The owner's surname.", email: validate.email(f.email), phone: /^(\+?233|0)\d{9}$/.test(f.phone.replace(/\s/g, '')) ? null : 'A Ghana number.' };
  if (done) return <SuccessState title="Vendor added" reassurance="The owner gets an email to set up their account." next="Approve the vendor once their menu is ready." action={{ label: 'Done', onPress: onDone }} />;
  return (
    <Card>
      <FormError error={error} />
      {(['vendorName', 'location', 'firstName', 'lastName', 'email', 'phone'] as const).map((k) => <TextField key={k} label={{ vendorName: 'Shop name', location: 'Location', firstName: "Owner's first name", lastName: "Owner's surname", email: "Owner's email", phone: "Owner's phone" }[k]} value={f[k]} autoCapitalize={k === 'email' ? 'none' : 'sentences'} keyboardType={k === 'email' ? 'email-address' : k === 'phone' ? 'phone-pad' : 'default'} onChangeText={(x) => setF({ ...f, [k]: x })} error={touched ? errs[k] : null} />)}
      <Button label="Add vendor" loading={busy} onPress={() => { setTouched(true); if (!Object.values(errs).some(Boolean)) void run(async () => { await foodApi.createVendor({ ...f, email: f.email.trim().toLowerCase(), phone: f.phone.replace(/\s/g, '') }); setDone(true); }); }} />
      <Button label="Cancel" variant="ghost" onPress={onDone} />
    </Card>
  );
}

function Settings({ s, onSaved }: { s: { commissionPercent: number; unpaidMinutes: number }; onSaved: () => void }) {
  const [f, setF] = useState({ commission: String(s.commissionPercent), unpaid: String(s.unpaidMinutes) });
  const { busy, error, run } = useSubmit();
  const errs = { commission: Number(f.commission) >= 0 && Number(f.commission) <= 30 ? null : 'From 0 to 30%.', unpaid: Number.isInteger(Number(f.unpaid)) && Number(f.unpaid) >= 5 && Number(f.unpaid) <= 120 ? null : 'From 5 to 120 minutes.' };
  return (
    <Card>
      <Text variant="heading">Marketplace settings</Text>
      <FormError error={error} />
      <View>
        <TextField label="University commission on online orders (%)" value={f.commission} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, commission: x })} error={errs.commission} />
        <TextField label="Cancel unpaid online orders after (minutes)" value={f.unpaid} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, unpaid: x })} error={errs.unpaid} />
      </View>
      <Button label="Save settings" disabled={Object.values(errs).some(Boolean)} loading={busy} onPress={() => void run(async () => { await foodApi.saveSettings({ commissionPercent: Number(f.commission), unpaidMinutes: Number(f.unpaid) }); onSaved(); })} />
    </Card>
  );
}
