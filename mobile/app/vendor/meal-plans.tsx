import { useState } from 'react';
import { View } from 'react-native';
import { formatCedis } from '@anu/shared';
import { foodApi, type MealPlan, type MyVendor } from '@/api/marketplace';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
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
import { useTheme } from '@/theme/useTheme';

type Plan = MealPlan & { _count: { purchases: number } };

export default function VendorPlans() {
  const plans = useQuery<Plan[]>('vendor.plans', '/vendor/meal-plans');
  const me = useQuery<MyVendor>('vendor.me', '/vendor');
  const [editing, setEditing] = useState<Plan | 'new' | null>(null);
  return (
    <Screen refreshing={plans.loading} onRefresh={plans.refresh}>
      <Header title="Meal plans" subtitle="Bundles students pay for once and use meal by meal." />
      {editing && me.data ? <PlanForm items={me.data.items} plan={editing === 'new' ? null : editing} onDone={() => { setEditing(null); plans.refresh(); }} /> : (
        <>
          <Button label="New plan" onPress={() => setEditing('new')} />
          <QueryView q={plans} skeleton={<SkeletonList rows={3} />}>
            {(list) => list.length === 0 ? <EmptyState title="No meal plans yet" why="A plan lets students pay once for several meals, which brings regular customers." /> : <>{list.map((p) => (
              <Card key={p.id}>
                <Text variant="heading">{p.name}</Text>
                <Text variant="small" tone="muted">{p.meals} meals for {formatCedis(p.price)}, within {p.validDays} days. {p._count.purchases} sold.</Text>
                {p.isActive === false ? <Badge label="Not on sale" /> : null}
                <Button label="Edit" variant="ghost" onPress={() => setEditing(p)} />
              </Card>
            ))}</>}
          </QueryView>
        </>
      )}
    </Screen>
  );
}

function PlanForm({ items, plan, onDone }: { items: MyVendor['items']; plan: Plan | null; onDone: () => void }) {
  const { space } = useTheme();
  const [f, setF] = useState({ name: plan?.name ?? '', meals: String(plan?.meals ?? 10), price: plan ? String(plan.price / 100) : '', validDays: String(plan?.validDays ?? 30), eligible: plan?.eligibleItemIds ?? [] as string[], isActive: plan?.isActive ?? true });
  const [touched, setTouched] = useState(false);
  const { busy, error, run } = useSubmit();
  const errs = { name: f.name.trim().length < 3 ? 'Name the plan, e.g. "10 lunches".' : null, meals: !(Number.isInteger(Number(f.meals)) && Number(f.meals) >= 2) ? 'At least 2 meals.' : null, price: !(Number(f.price) > 0) ? 'Price in cedis.' : null, days: !(Number.isInteger(Number(f.validDays)) && Number(f.validDays) >= 1) ? 'Valid for at least 1 day.' : null, eligible: !f.eligible.length ? 'Choose the dishes the plan covers.' : null };
  return (
    <Card>
      <Text variant="heading">{plan ? 'Edit plan' : 'New plan'}</Text>
      <FormError error={error} />
      <TextField label="Name" value={f.name} onChangeText={(x) => setF({ ...f, name: x })} error={touched ? errs.name : null} />
      <TextField label="Meals" value={f.meals} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, meals: x })} error={touched ? errs.meals : null} />
      <TextField label="Price (GH₵)" value={f.price} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, price: x.replace(',', '.') })} error={touched ? errs.price : null} />
      <TextField label="Use within (days)" value={f.validDays} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, validDays: x })} error={touched ? errs.days : null} />
      <Text variant="label">Dishes it covers</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {items.map((i) => <Chip key={i.id} label={i.name} selected={f.eligible.includes(i.id)} onPress={() => setF({ ...f, eligible: f.eligible.includes(i.id) ? f.eligible.filter((x) => x !== i.id) : [...f.eligible, i.id] })} />)}
      </View>
      {touched && errs.eligible ? <Text variant="small" tone="danger">{errs.eligible}</Text> : null}
      <Chip label={f.isActive ? 'On sale' : 'Not on sale'} selected={f.isActive} onPress={() => setF({ ...f, isActive: !f.isActive })} />
      <Button label="Save plan" loading={busy} onPress={() => {
        setTouched(true);
        if (Object.values(errs).some(Boolean)) return;
        void run(async () => { await foodApi.savePlan({ name: f.name.trim(), meals: Number(f.meals), price: Math.round(Number(f.price) * 100), validDays: Number(f.validDays), eligibleItemIds: f.eligible, isActive: f.isActive }, plan?.id); onDone(); });
      }} />
      <Button label="Cancel" variant="ghost" onPress={onDone} />
    </Card>
  );
}
