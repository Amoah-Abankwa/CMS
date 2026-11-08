import { useState } from 'react';
import { View } from 'react-native';
import { foodApi, type MenuItem, type MyVendor } from '@/api/marketplace';
import { FormError } from '@/components/states/FormError';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';
import { pickAndUploadImage } from '@/lib/uploadImage';
import { useTheme } from '@/theme/useTheme';

/** Adding or changing a dish; prices in cedis, checked inline. */
export function ItemForm({ v, item, onDone }: { v: MyVendor; item: MenuItem | null; onDone: () => void }) {
  const { space } = useTheme();
  const [f, setF] = useState({ name: item?.name ?? '', price: item ? String(item.price / 100) : '', description: item?.description ?? '', categoryId: item?.categoryId ?? null as string | null });
  const [touched, setTouched] = useState(false);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const { busy, error, run, setError } = useSubmit();
  const errs = { name: f.name.trim().length < 2 ? 'Give the dish a name.' : null, price: !(Number(f.price) > 0) ? 'Price in cedis, e.g. 25 or 12.50.' : null };
  return (
    <Card>
      <Text variant="heading">{item ? `Edit ${item.name}` : 'Add a dish'}</Text>
      <FormError error={error} />
      <TextField label="Name" value={f.name} onChangeText={(x) => setF({ ...f, name: x })} error={touched ? errs.name : null} />
      <TextField label="Price (GH₵)" value={f.price} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, price: x.replace(',', '.') })} error={touched ? errs.price : null} />
      <TextField label="Description (optional)" value={f.description} onChangeText={(x) => setF({ ...f, description: x })} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {v.categories.map((c) => <Chip key={c.id} label={c.name} selected={f.categoryId === c.id} onPress={() => setF({ ...f, categoryId: f.categoryId === c.id ? null : c.id })} />)}
      </View>
      {item ? <Button label={item.photoUrl ? 'Change photo' : 'Add a photo'} variant="secondary" loading={busy} onPress={() => void run(async () => {
        try {
          const id = await pickAndUploadImage('menu', item.id);
          if (id) { await axiosInstance.put(`/uploads/menu-items/${item.id}/photo`, { publicId: id }); setPhotoNote('Photo saved.'); }
        } catch (e) { setPhotoNote(e instanceof Error ? e.message : 'The photo could not be saved.'); }
      })} /> : null}
      {photoNote ? <Text variant="small">{photoNote}</Text> : null}
      <Button label="Save" loading={busy} onPress={() => {
        setTouched(true); setError(null);
        if (errs.name || errs.price) return;
        void run(async () => { await foodApi.saveItem({ name: f.name.trim(), price: Math.round(Number(f.price) * 100), description: f.description.trim() || undefined, categoryId: f.categoryId }, item?.id); onDone(); });
      }} />
      <Button label="Cancel" variant="ghost" onPress={onDone} />
    </Card>
  );
}
