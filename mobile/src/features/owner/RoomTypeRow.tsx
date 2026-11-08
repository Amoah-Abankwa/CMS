import { useState } from 'react';
import { View } from 'react-native';
import { formatCedis } from '@anu/shared';
import { accommodationApi, type RoomType } from '@/api/accommodation';
import { FormError } from '@/components/states/FormError';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

/** A room type's beds left and price, kept up to date so students see what is really free. */
export function RoomTypeRow({ hostelId, r, onSaved }: { hostelId: string; r: RoomType; onSaved: () => void }) {
  const { space } = useTheme();
  const [editing, setEditing] = useState(false);
  const [beds, setBeds] = useState(String(r.availableBeds));
  const [price, setPrice] = useState(String(r.pricePerSemester / 100));
  const { busy, error, run } = useSubmit();
  const bedsError = !(Number.isInteger(Number(beds)) && Number(beds) >= 0) ? 'A whole number, 0 or more.' : null;
  const priceError = !(Number(price) > 0) ? 'Price a semester in cedis.' : null;
  if (!editing) return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Text style={{ flex: 1 }}>{r.name}: {r.availableBeds} beds free, {formatCedis(r.pricePerSemester)}</Text>
      <Button label="Change" variant="ghost" onPress={() => setEditing(true)} />
    </View>
  );
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="label">{r.name}</Text>
      <FormError error={error} />
      <TextField label="Beds free" value={beds} keyboardType="number-pad" onChangeText={setBeds} error={bedsError} />
      <TextField label="Price a semester (GH₵)" value={price} keyboardType="decimal-pad" onChangeText={setPrice} error={priceError} />
      <Button label="Save" disabled={!!bedsError || !!priceError} loading={busy} onPress={() => void run(async () => { await accommodationApi.saveRoomType(hostelId, { name: r.name, bedsPerRoom: r.bedsPerRoom, description: r.description, availableBeds: Number(beds), pricePerSemester: Math.round(Number(price) * 100) }, r.id); setEditing(false); onSaved(); })} />
      <Button label="Cancel" variant="ghost" onPress={() => setEditing(false)} />
    </View>
  );
}
