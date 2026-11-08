import { useState } from 'react';
import { Switch, View } from 'react-native';
import { formatCedis } from '@anu/shared';
import { foodApi, type MenuItem, type MyVendor } from '@/api/marketplace';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { ItemForm } from '@/features/vendor/ItemForm';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

export default function VendorMenu() {
  const { space, colors } = useTheme();
  const q = useQuery<MyVendor>('vendor.me', '/vendor');
  const [editing, setEditing] = useState<MenuItem | 'new' | null>(null);
  const [category, setCategory] = useState('');
  const { busy, error, run } = useSubmit();
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Menu" />
      <FormError error={error} />
      <QueryView q={q} skeleton={<SkeletonList rows={6} />}>
        {(v) => editing ? <ItemForm v={v} item={editing === 'new' ? null : editing} onDone={() => { setEditing(null); q.refresh(); }} /> : (
          <View style={{ gap: space.md }}>
            <Button label="Add a dish" onPress={() => setEditing('new')} />
            {v.items.length === 0 ? <EmptyState title="Your menu is empty" why="Students see nothing to order until you add dishes." /> : [...v.categories, { id: '', name: 'Other', position: 99 }].map((c) => {
              const items = v.items.filter((i) => (i.categoryId ?? '') === c.id);
              if (!items.length) return null;
              return (
                <View key={c.id || 'other'} style={{ gap: space.sm }}>
                  <Text variant="heading">{c.name}</Text>
                  {items.map((i) => (
                    <Card key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                      <View style={{ flex: 1 }}>
                        <Text variant="label">{i.name}</Text>
                        <Text variant="small" tone="muted">{formatCedis(i.price)}{i.isAvailable ? '' : ', not available today'}</Text>
                        <Button label="Edit" variant="ghost" onPress={() => setEditing(i)} />
                      </View>
                      <Switch value={i.isAvailable} onValueChange={(on) => void run(async () => { await foodApi.setAvailable(i.id, on); q.refresh(); })} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel={`${i.name} available`} />
                    </Card>
                  ))}
                </View>
              );
            })}
            <Card>
              <TextField label="New category" value={category} onChangeText={setCategory} placeholder="Breakfast, Drinks" />
              <Button label="Add category" variant="secondary" disabled={category.trim().length < 2} loading={busy} onPress={() => void run(async () => { await foodApi.saveCategory(category.trim()); setCategory(''); q.refresh(); })} />
            </Card>
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
